# Chatbot Session-Based Memory & JSON Parsing Fix

## Implementation Date
2026-05-05

## Problem Statement

### Issue 1: No Session Memory
- Chat history was stored in DB but **never sent to the LLM**
- Each chat request was isolated - no context from previous messages
- Users couldn't have continuous conversations
- LLM couldn't reference earlier modifications

### Issue 2: JSON Parsing Failures
- OpenRouter LLMs returned malformed JSON:
  - Trailing commas
  - Unescaped newlines in strings
  - Single quotes instead of double quotes
  - Markdown code fences
  - Comments (`//` or `/* */`)
- Previous attempts (json5, regex cleanup) helped but didn't fully resolve
- Success rate still too low for production

---

## Solution Overview

Implemented a **5-tier robust architecture** for chatbot QB modification:

### 1. **Session-Based Memory** ✅
- Load chat history from DB (`QuestionBank.chat_history`)
- Send last 10 messages to OpenRouter as conversation context
- LLM now has full context of previous turns
- Enables natural multi-turn conversations

### 2. **OpenRouter JSON Mode** ✅
- Use `response_format: {"type": "json_object"}` parameter
- Forces LLM to return structured JSON (not free-form text)
- Dramatically reduces malformed JSON issues

### 3. **Multi-Level Fallback Parsing** ✅
**Strategy 1**: Standard `json.loads()`
**Strategy 2**: `json5.loads()` (allows trailing commas, comments)
**Strategy 3**: Extract JSON with regex + json5
**Strategy 4**: LLM self-correction (ask it to fix its own JSON)

### 4. **Retry Logic** ✅
- On parse failure, retry once with stricter prompt
- Lower temperature (0.2 vs 0.3) on retry
- Append feedback: "That had errors, please fix"

### 5. **Graceful Degradation** ✅
- If all strategies fail, return friendly error message
- Preserve original questions (no data loss)
- User can retry with rephrased request

---

## Code Changes

### File: `backend/services/qb_generator.py`

#### Change 1: Add `chat_history` parameter
```python
async def chat_modify_questions(
    self,
    current_questions: Dict[str, Any],
    user_message: str,
    candidate_context: Optional[str] = None,
    chat_history: Optional[List[Dict[str, Any]]] = None  # NEW
) -> Dict[str, Any]:
```

#### Change 2: Build conversation messages
```python
# Build conversation messages with history for session-based memory
messages = [
    {
        "role": "system",
        "content": "You are a helpful interview preparation assistant..."
    }
]

# Add chat history for context continuity (session-based memory)
if chat_history:
    for entry in chat_history[-10:]:  # Last 10 messages to avoid token limits
        role = entry.get("role", "user")
        content = entry.get("content", "")
        if role in ["user", "assistant"]:
            messages.append({"role": role, "content": content})

# Add current user message
messages.append({"role": "user", "content": prompt})
```

#### Change 3: Use OpenRouter JSON mode
```python
payload = {
    "model": self.model,
    "messages": messages,
    "temperature": 0.2 if is_retry else 0.3,
    "max_tokens": 8000,
    "response_format": {"type": "json_object"}  # OpenRouter JSON mode
}
```

#### Change 4: Implement retry logic
```python
# Try with retry logic (2 attempts)
for attempt in range(2):
    is_retry = attempt > 0
    
    # ... make request ...
    
    modified = await self._parse_json_with_fallback(content, current_questions)
    
    if modified is not None:
        return {"success": True, ...}
    
    # Retry with stricter prompt
    if is_retry:
        break
    
    messages.append({"role": "assistant", "content": content})
    messages.append({
        "role": "user",
        "content": "That response had JSON formatting errors. Please return ONLY the JSON..."
    })
```

#### Change 5: Add multi-level fallback parser
```python
async def _parse_json_with_fallback(
    self,
    content: str,
    fallback_questions: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Parse JSON with multi-level fallback strategies."""
    
    # Strategy 1: Standard JSON parser
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.warning(f"Standard JSON parsing failed: {e}")
    
    # Strategy 2: json5 parser
    try:
        return json5.loads(content)
    except Exception as e:
        logger.warning(f"json5 parsing failed: {e}")
    
    # Strategy 3: Extract JSON and retry with json5
    json_match = re.search(r'\{[\s\S]*\}', content)
    if json_match:
        try:
            return json5.loads(self._clean_json_string(json_match.group(0)))
        except Exception as e:
            logger.warning(f"Extracted JSON parsing failed: {e}")
    
    # Strategy 4: Ask LLM to fix its own JSON
    try:
        return await self._fix_json_with_llm(content)
    except Exception as e:
        logger.error(f"LLM self-correction failed: {e}")
    
    return None
```

#### Change 6: Add LLM self-correction
```python
async def _fix_json_with_llm(self, malformed_json: str) -> Optional[Dict[str, Any]]:
    """Ask the LLM to fix its own malformed JSON."""
    response = await client.post(
        self.api_url,
        json={
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a JSON fixing assistant. Fix malformed JSON and return ONLY the corrected JSON."
                },
                {
                    "role": "user",
                    "content": f"Fix this malformed JSON:\n\n{malformed_json[:2000]}"
                }
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
    )
    
    fixed_content = response.json()["choices"][0]["message"]["content"]
    return json.loads(self._clean_json_string(fixed_content))
```

### File: `backend/routers/interviewers.py`

#### Change 1: Pass chat history to service
```python
# Get chat history for session-based memory
chat_history = qb.chat_history or []

# Call LLM to modify with full conversation history
result = await qb_generator.chat_modify_questions(
    current_questions,
    request.message,
    candidate_context,
    chat_history  # Pass history for context continuity
)
```

---

## Database Schema

**No changes needed!** ✅

The `QuestionBank` table already has the `chat_history` column:
```python
chat_history = Column(JSON, nullable=True)  # List of {role, content, timestamp}
```

Each entry in `chat_history`:
```json
{
  "role": "user" | "assistant",
  "content": "message content",
  "timestamp": "2026-05-05T10:30:00Z"
}
```

---

## Testing

### Manual Testing Steps

1. **Test session memory:**
   ```bash
   cd backend
   source venv/bin/activate
   python test_chatbot_session.py
   ```

2. **Test in UI:**
   - Open Interviewer Dashboard
   - Generate QB for a candidate
   - Chat: "Add more system design questions"
   - Chat: "Now add one about Kubernetes" (should remember previous context)
   - Chat: "Remove the first question we added" (should reference earlier)

3. **Test JSON parsing:**
   - Make complex requests with long answers
   - Try edge cases: questions with quotes, special chars
   - Monitor backend logs for parsing strategy used

### Expected Results

✅ **Session Memory Works:**
- LLM references previous turns naturally
- Can modify based on earlier context
- Multi-turn conversations feel natural

✅ **JSON Parsing Success Rate > 95%:**
- OpenRouter JSON mode should handle most cases
- Fallback strategies catch remaining issues
- No crashes or data loss

✅ **Graceful Degradation:**
- If all parsing fails, clear error message
- Original questions preserved
- User can retry

---

## Production Deployment

### Pre-Deployment Checklist

- [x] Code changes implemented
- [x] Test script created
- [ ] Local testing completed
- [ ] Verified chat history persists across sessions
- [ ] Tested multi-turn conversations (3+ turns)
- [ ] Tested with complex requests
- [ ] Verified no regressions in QB generation
- [ ] Backend logs show correct parsing strategies

### Deployment Steps

1. **Test locally:**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload
   
   # In another terminal
   python test_chatbot_session.py
   ```

2. **Commit changes:**
   ```bash
   git add backend/services/qb_generator.py
   git add backend/routers/interviewers.py
   git add backend/test_chatbot_session.py
   git add CHATBOT_SESSION_MEMORY_FIX.md
   
   git commit -m "Fix: Add session-based memory and robust JSON parsing to QB chatbot

   - Implement true session memory by sending chat history to OpenRouter
   - Use OpenRouter JSON mode for structured output
   - Add 4-level fallback parsing (json → json5 → extract → self-correct)
   - Implement retry logic with stricter prompt on failure
   - Add LLM self-correction for malformed JSON
   - Graceful degradation with preserved questions
   - Character limits on suggested_answer fields
   
   This fixes the critical chatbot JSON parsing issue and enables
   continuous multi-turn conversations with context continuity.
   
   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

3. **Push to production:**
   ```bash
   git push origin main
   ```

4. **Monitor deployment:**
   - Watch GitHub Actions for successful build
   - Check Azure Container Apps logs for errors
   - Test chatbot in production UI

5. **Verify in production:**
   ```bash
   # Check backend logs
   az containerapp logs show --name hiring-backend --resource-group hiring-rg --follow
   
   # Test API directly
   curl -X POST https://hiring-backend.happymushroom-06d2d3fe.centralindia.azurecontainerapps.io/health
   ```

---

## Monitoring & Debugging

### Key Metrics to Watch

1. **JSON Parse Success Rate:**
   - Monitor backend logs for parse strategy used
   - Track how often fallback strategies are needed
   - Alert if success rate drops below 95%

2. **Chat Session Length:**
   - Average number of turns per QB modification
   - Are users having continuous conversations?

3. **Error Messages:**
   - Track "invalid JSON" error frequency
   - Monitor retry attempts

### Log Messages to Watch For

```
✅ Success indicators:
- "Successfully parsed with json5"
- "Successfully parsed extracted JSON with json5"
- "Successfully fixed JSON via LLM self-correction"

⚠️ Warning indicators:
- "Standard JSON parsing failed"
- "Attempt 1 failed, retrying with stricter prompt..."
- "LLM self-correction failed"

❌ Error indicators:
- "All parsing strategies failed"
- "AI returned invalid JSON after multiple attempts"
```

### Debug Commands

```bash
# Tail backend logs
az containerapp logs show --name hiring-backend --resource-group hiring-rg --follow --type=console

# Check recent errors
az containerapp logs show --name hiring-backend --resource-group hiring-rg --tail 100 | grep ERROR

# Test chatbot locally with verbose logging
cd backend
export LOG_LEVEL=DEBUG
python test_chatbot_session.py
```

---

## Rollback Plan

If issues arise in production:

### Quick Rollback (revert deployment)
```bash
# List recent revisions
az containerapp revision list -n hiring-backend -g hiring-rg -o table

# Rollback to previous revision
az containerapp ingress traffic set -n hiring-backend -g hiring-rg \
  --revision-weight <previous-revision-name>=100
```

### Code Rollback
```bash
# Revert the commit
git revert HEAD
git push origin main
```

### Emergency Disable
If chatbot is completely broken, users can still use manual QB editing buttons (add/edit/delete). The chatbot is an enhancement, not a critical path.

---

## Future Enhancements

### Potential Improvements (Not in This PR)

1. **Structured Output Schema:**
   - Some OpenRouter models support JSON schema validation
   - Would further reduce parsing errors

2. **Token Usage Optimization:**
   - Currently sends last 10 messages
   - Could implement smarter context window management
   - Summarize old messages vs sending verbatim

3. **User Feedback Loop:**
   - Track which requests fail most often
   - Use failures to improve prompts

4. **Model Switching:**
   - Fall back to different model if primary fails
   - Claude models are better at JSON than GPT models

5. **Caching:**
   - Cache common modification patterns
   - Reduce API calls for similar requests

---

## Related Issues

- Fixes: JSON parsing errors in QB chatbot (critical issue)
- Enables: Session-based memory for continuous conversations
- Improves: User experience with multi-turn QB modifications
- Related: `archive/session_docs/JSON5_FINAL_FIX.md` (previous attempt)

---

## Success Criteria

✅ **Must Have (This PR):**
- [x] Chat history sent to OpenRouter
- [x] OpenRouter JSON mode enabled
- [x] Multi-level fallback parsing
- [x] Retry logic implemented
- [x] LLM self-correction fallback
- [x] Graceful error handling
- [x] No data loss on errors
- [x] Backwards compatible

🎯 **Success Metrics:**
- JSON parse success rate > 95%
- Users can have 5+ turn conversations
- No crashes or data loss
- Error messages are actionable

---

## Contact

For issues or questions about this implementation:
- Check backend logs first
- Review this document
- Test locally with `test_chatbot_session.py`
- Check `archive/session_docs/` for historical context

**Note:** This is a production-critical fix. Test thoroughly before deploying.
