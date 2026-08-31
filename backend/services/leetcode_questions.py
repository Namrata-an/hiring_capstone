"""LeetCode Question Bank by Skill.

Curated LeetCode easy/medium questions mapped to technical skills.
Each question includes the problem link, difficulty, and solution hints.
"""

from typing import Dict, List, Any

# LeetCode questions organized by skill category
LEETCODE_QUESTIONS: Dict[str, List[Dict[str, Any]]] = {
    # ========== Data Structures & Algorithms ==========
    "arrays": [
        {
            "title": "Two Sum",
            "url": "https://leetcode.com/problems/two-sum/",
            "difficulty": "Easy",
            "solution_hint": "Use a hash map to store complements. Time: O(n), Space: O(n)."
        },
        {
            "title": "Best Time to Buy and Sell Stock",
            "url": "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/",
            "difficulty": "Easy",
            "solution_hint": "Track minimum price seen so far and max profit. Single pass O(n)."
        },
        {
            "title": "Contains Duplicate",
            "url": "https://leetcode.com/problems/contains-duplicate/",
            "difficulty": "Easy",
            "solution_hint": "Use a set to track seen elements. Return true if already in set."
        },
        {
            "title": "Product of Array Except Self",
            "url": "https://leetcode.com/problems/product-of-array-except-self/",
            "difficulty": "Medium",
            "solution_hint": "Two passes: left products then right products. No division needed."
        },
        {
            "title": "Maximum Subarray",
            "url": "https://leetcode.com/problems/maximum-subarray/",
            "difficulty": "Medium",
            "solution_hint": "Kadane's algorithm: track current sum, reset if negative."
        },
        {
            "title": "3Sum",
            "url": "https://leetcode.com/problems/3sum/",
            "difficulty": "Medium",
            "solution_hint": "Sort array, fix one element, use two pointers for remaining two."
        },
    ],
    
    "strings": [
        {
            "title": "Valid Anagram",
            "url": "https://leetcode.com/problems/valid-anagram/",
            "difficulty": "Easy",
            "solution_hint": "Count character frequencies using hash map or array[26]."
        },
        {
            "title": "Valid Palindrome",
            "url": "https://leetcode.com/problems/valid-palindrome/",
            "difficulty": "Easy",
            "solution_hint": "Two pointers from start and end, skip non-alphanumeric."
        },
        {
            "title": "Longest Substring Without Repeating Characters",
            "url": "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
            "difficulty": "Medium",
            "solution_hint": "Sliding window with set/map to track characters in current window."
        },
        {
            "title": "Group Anagrams",
            "url": "https://leetcode.com/problems/group-anagrams/",
            "difficulty": "Medium",
            "solution_hint": "Use sorted string or character count tuple as hash key."
        },
        {
            "title": "Longest Palindromic Substring",
            "url": "https://leetcode.com/problems/longest-palindromic-substring/",
            "difficulty": "Medium",
            "solution_hint": "Expand around center for each position. O(n²) time."
        },
    ],
    
    "linked_lists": [
        {
            "title": "Reverse Linked List",
            "url": "https://leetcode.com/problems/reverse-linked-list/",
            "difficulty": "Easy",
            "solution_hint": "Iterative: track prev, curr, next. Or recursive with base case."
        },
        {
            "title": "Merge Two Sorted Lists",
            "url": "https://leetcode.com/problems/merge-two-sorted-lists/",
            "difficulty": "Easy",
            "solution_hint": "Use dummy head, compare and append smaller node."
        },
        {
            "title": "Linked List Cycle",
            "url": "https://leetcode.com/problems/linked-list-cycle/",
            "difficulty": "Easy",
            "solution_hint": "Floyd's cycle detection: slow and fast pointers."
        },
        {
            "title": "Remove Nth Node From End of List",
            "url": "https://leetcode.com/problems/remove-nth-node-from-end-of-list/",
            "difficulty": "Medium",
            "solution_hint": "Two pointers: advance fast by n, then move both until fast reaches end."
        },
        {
            "title": "Reorder List",
            "url": "https://leetcode.com/problems/reorder-list/",
            "difficulty": "Medium",
            "solution_hint": "Find middle, reverse second half, merge alternately."
        },
    ],
    
    "trees": [
        {
            "title": "Maximum Depth of Binary Tree",
            "url": "https://leetcode.com/problems/maximum-depth-of-binary-tree/",
            "difficulty": "Easy",
            "solution_hint": "Recursive DFS: return 1 + max(left, right). Base case: null = 0."
        },
        {
            "title": "Invert Binary Tree",
            "url": "https://leetcode.com/problems/invert-binary-tree/",
            "difficulty": "Easy",
            "solution_hint": "Recursively swap left and right children."
        },
        {
            "title": "Same Tree",
            "url": "https://leetcode.com/problems/same-tree/",
            "difficulty": "Easy",
            "solution_hint": "Recursive comparison: both null = true, one null = false, compare values."
        },
        {
            "title": "Binary Tree Level Order Traversal",
            "url": "https://leetcode.com/problems/binary-tree-level-order-traversal/",
            "difficulty": "Medium",
            "solution_hint": "BFS with queue, process level by level using queue size."
        },
        {
            "title": "Validate Binary Search Tree",
            "url": "https://leetcode.com/problems/validate-binary-search-tree/",
            "difficulty": "Medium",
            "solution_hint": "Inorder traversal should be sorted. Or pass min/max bounds recursively."
        },
        {
            "title": "Lowest Common Ancestor of a Binary Tree",
            "url": "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/",
            "difficulty": "Medium",
            "solution_hint": "Recursive: if current is p or q, return it. Check left/right subtrees."
        },
    ],
    
    "graphs": [
        {
            "title": "Number of Islands",
            "url": "https://leetcode.com/problems/number-of-islands/",
            "difficulty": "Medium",
            "solution_hint": "DFS/BFS from each unvisited '1', mark visited. Count connected components."
        },
        {
            "title": "Clone Graph",
            "url": "https://leetcode.com/problems/clone-graph/",
            "difficulty": "Medium",
            "solution_hint": "BFS/DFS with hash map mapping old nodes to cloned nodes."
        },
        {
            "title": "Course Schedule",
            "url": "https://leetcode.com/problems/course-schedule/",
            "difficulty": "Medium",
            "solution_hint": "Topological sort. Detect cycle using DFS with visiting/visited states."
        },
        {
            "title": "Pacific Atlantic Water Flow",
            "url": "https://leetcode.com/problems/pacific-atlantic-water-flow/",
            "difficulty": "Medium",
            "solution_hint": "BFS/DFS from ocean borders inward. Find intersection of reachable cells."
        },
    ],
    
    "dynamic_programming": [
        {
            "title": "Climbing Stairs",
            "url": "https://leetcode.com/problems/climbing-stairs/",
            "difficulty": "Easy",
            "solution_hint": "Fibonacci: dp[i] = dp[i-1] + dp[i-2]. Base: dp[1]=1, dp[2]=2."
        },
        {
            "title": "House Robber",
            "url": "https://leetcode.com/problems/house-robber/",
            "difficulty": "Medium",
            "solution_hint": "dp[i] = max(dp[i-1], dp[i-2] + nums[i]). Rob or skip each house."
        },
        {
            "title": "Coin Change",
            "url": "https://leetcode.com/problems/coin-change/",
            "difficulty": "Medium",
            "solution_hint": "Bottom-up DP: dp[amount] = min coins needed. Try each coin denomination."
        },
        {
            "title": "Longest Increasing Subsequence",
            "url": "https://leetcode.com/problems/longest-increasing-subsequence/",
            "difficulty": "Medium",
            "solution_hint": "O(n²): dp[i] = max length ending at i. O(n log n): binary search with patience sorting."
        },
        {
            "title": "Unique Paths",
            "url": "https://leetcode.com/problems/unique-paths/",
            "difficulty": "Medium",
            "solution_hint": "dp[i][j] = dp[i-1][j] + dp[i][j-1]. Or use math: C(m+n-2, m-1)."
        },
    ],
    
    "hash_maps": [
        {
            "title": "Two Sum",
            "url": "https://leetcode.com/problems/two-sum/",
            "difficulty": "Easy",
            "solution_hint": "Store complement (target - num) in map while iterating."
        },
        {
            "title": "Valid Anagram",
            "url": "https://leetcode.com/problems/valid-anagram/",
            "difficulty": "Easy",
            "solution_hint": "Character frequency count using hash map."
        },
        {
            "title": "LRU Cache",
            "url": "https://leetcode.com/problems/lru-cache/",
            "difficulty": "Medium",
            "solution_hint": "Hash map + doubly linked list. Move accessed items to front."
        },
        {
            "title": "Top K Frequent Elements",
            "url": "https://leetcode.com/problems/top-k-frequent-elements/",
            "difficulty": "Medium",
            "solution_hint": "Count frequencies with map, then use heap or bucket sort."
        },
    ],
    
    # ========== Language-Specific ==========
    "python": [
        {
            "title": "Reverse Integer",
            "url": "https://leetcode.com/problems/reverse-integer/",
            "difficulty": "Medium",
            "solution_hint": "Handle sign separately, reverse digits using modulo and division. Check overflow."
        },
        {
            "title": "Valid Parentheses",
            "url": "https://leetcode.com/problems/valid-parentheses/",
            "difficulty": "Easy",
            "solution_hint": "Use stack, push opening brackets, pop and match for closing."
        },
        {
            "title": "Merge Intervals",
            "url": "https://leetcode.com/problems/merge-intervals/",
            "difficulty": "Medium",
            "solution_hint": "Sort by start, merge if current start <= prev end."
        },
    ],
    
    "javascript": [
        {
            "title": "Valid Parentheses",
            "url": "https://leetcode.com/problems/valid-parentheses/",
            "difficulty": "Easy",
            "solution_hint": "Stack-based matching. Use object for bracket pairs."
        },
        {
            "title": "Implement Queue using Stacks",
            "url": "https://leetcode.com/problems/implement-queue-using-stacks/",
            "difficulty": "Easy",
            "solution_hint": "Two stacks: push to stack1, lazy transfer to stack2 for pop/peek."
        },
        {
            "title": "Design Browser History",
            "url": "https://leetcode.com/problems/design-browser-history/",
            "difficulty": "Medium",
            "solution_hint": "Use array with current index pointer. Clear forward history on visit."
        },
    ],
    
    "java": [
        {
            "title": "Reverse Linked List",
            "url": "https://leetcode.com/problems/reverse-linked-list/",
            "difficulty": "Easy",
            "solution_hint": "Iterative with prev/curr/next pointers."
        },
        {
            "title": "Merge K Sorted Lists",
            "url": "https://leetcode.com/problems/merge-k-sorted-lists/",
            "difficulty": "Hard",
            "solution_hint": "Use PriorityQueue (min heap) with custom comparator."
        },
    ],
    
    # ========== Domain-Specific ==========
    "sql": [
        {
            "title": "Combine Two Tables",
            "url": "https://leetcode.com/problems/combine-two-tables/",
            "difficulty": "Easy",
            "solution_hint": "LEFT JOIN Person with Address on PersonId."
        },
        {
            "title": "Second Highest Salary",
            "url": "https://leetcode.com/problems/second-highest-salary/",
            "difficulty": "Medium",
            "solution_hint": "Subquery or LIMIT/OFFSET with DISTINCT. Handle null case."
        },
        {
            "title": "Rank Scores",
            "url": "https://leetcode.com/problems/rank-scores/",
            "difficulty": "Medium",
            "solution_hint": "DENSE_RANK() window function or correlated subquery."
        },
        {
            "title": "Department Top Three Salaries",
            "url": "https://leetcode.com/problems/department-top-three-salaries/",
            "difficulty": "Hard",
            "solution_hint": "Window function with DENSE_RANK() partitioned by department."
        },
    ],
    
    "system_design": [
        {
            "title": "Design Twitter",
            "url": "https://leetcode.com/problems/design-twitter/",
            "difficulty": "Medium",
            "solution_hint": "Hash maps for user tweets and follows. Merge k sorted lists for feed."
        },
        {
            "title": "LRU Cache",
            "url": "https://leetcode.com/problems/lru-cache/",
            "difficulty": "Medium",
            "solution_hint": "OrderedDict in Python, or HashMap + DoublyLinkedList."
        },
        {
            "title": "Design HashMap",
            "url": "https://leetcode.com/problems/design-hashmap/",
            "difficulty": "Easy",
            "solution_hint": "Array of buckets with linked list chaining for collisions."
        },
    ],
    
    "react": [
        {
            "title": "Debounce",
            "url": "https://leetcode.com/problems/debounce/",
            "difficulty": "Medium",
            "solution_hint": "Clear previous timeout on each call, set new one. Return wrapper function."
        },
        {
            "title": "Throttle",
            "url": "https://leetcode.com/problems/throttle/",
            "difficulty": "Medium",
            "solution_hint": "Track last execution time. Only execute if enough time has passed."
        },
    ],
    
    "backend": [
        {
            "title": "Design Underground System",
            "url": "https://leetcode.com/problems/design-underground-system/",
            "difficulty": "Medium",
            "solution_hint": "Two hash maps: one for check-ins, one for travel times (sum, count)."
        },
        {
            "title": "Time Based Key-Value Store",
            "url": "https://leetcode.com/problems/time-based-key-value-store/",
            "difficulty": "Medium",
            "solution_hint": "Hash map with sorted list of (timestamp, value). Binary search for get."
        },
    ],
    
    "api_design": [
        {
            "title": "Design Twitter",
            "url": "https://leetcode.com/problems/design-twitter/",
            "difficulty": "Medium",
            "solution_hint": "Consider REST API patterns: /users/{id}/tweets, /users/{id}/feed"
        },
        {
            "title": "Design Hit Counter",
            "url": "https://leetcode.com/problems/design-hit-counter/",
            "difficulty": "Medium",
            "solution_hint": "Circular buffer of size 300 (for 5 min window) or queue with timestamps."
        },
    ],
}

# Skill keyword to category mapping
SKILL_TO_CATEGORY: Dict[str, List[str]] = {
    # Programming languages
    "python": ["python", "arrays", "strings", "dynamic_programming"],
    "javascript": ["javascript", "arrays", "strings", "hash_maps"],
    "typescript": ["javascript", "arrays", "strings", "hash_maps"],
    "java": ["java", "arrays", "linked_lists", "trees"],
    "c++": ["arrays", "dynamic_programming", "trees"],
    "go": ["arrays", "strings", "graphs"],
    "rust": ["arrays", "strings", "dynamic_programming"],
    
    # Frontend
    "react": ["react", "javascript", "strings"],
    "vue": ["javascript", "strings"],
    "angular": ["javascript", "strings"],
    "next.js": ["react", "javascript"],
    "nextjs": ["react", "javascript"],
    
    # Backend
    "node.js": ["backend", "javascript", "api_design"],
    "nodejs": ["backend", "javascript", "api_design"],
    "express": ["backend", "api_design"],
    "fastapi": ["backend", "python", "api_design"],
    "django": ["backend", "python", "api_design"],
    "flask": ["backend", "python", "api_design"],
    "spring": ["java", "backend", "api_design"],
    
    # Databases
    "sql": ["sql"],
    "postgresql": ["sql"],
    "mysql": ["sql"],
    "mongodb": ["hash_maps", "backend"],
    "redis": ["hash_maps", "system_design"],
    
    # Data structures & Algorithms
    "data structures": ["arrays", "linked_lists", "trees", "graphs", "hash_maps"],
    "algorithms": ["arrays", "dynamic_programming", "graphs"],
    "dsa": ["arrays", "linked_lists", "trees", "graphs", "dynamic_programming"],
    
    # System Design
    "system design": ["system_design", "api_design"],
    "microservices": ["system_design", "api_design"],
    "distributed systems": ["system_design", "graphs"],
    
    # General
    "backend": ["backend", "api_design", "sql"],
    "frontend": ["javascript", "react", "strings"],
    "full stack": ["backend", "javascript", "sql", "api_design"],
    "fullstack": ["backend", "javascript", "sql", "api_design"],
}


def get_leetcode_questions_for_skills(skills: List[str], max_per_category: int = 3) -> List[Dict[str, Any]]:
    """Get relevant LeetCode questions based on candidate skills.
    
    Args:
        skills: List of candidate skills (e.g., ["Python", "React", "SQL"])
        max_per_category: Maximum questions per category to include
        
    Returns:
        List of LeetCode questions with metadata
    """
    questions = []
    seen_urls = set()  # Avoid duplicates
    categories_used = set()
    
    # Normalize skills to lowercase
    normalized_skills = [s.lower().strip() for s in skills]
    
    # Map skills to categories
    for skill in normalized_skills:
        categories = SKILL_TO_CATEGORY.get(skill, [])
        
        # Also check for partial matches
        if not categories:
            for key, cats in SKILL_TO_CATEGORY.items():
                if key in skill or skill in key:
                    categories = cats
                    break
        
        categories_used.update(categories)
    
    # If no categories found, use general DSA categories
    if not categories_used:
        categories_used = {"arrays", "strings", "dynamic_programming", "trees"}
    
    # Collect questions from each category
    for category in categories_used:
        category_questions = LEETCODE_QUESTIONS.get(category, [])
        count = 0
        
        for q in category_questions:
            if q["url"] not in seen_urls and count < max_per_category:
                questions.append({
                    **q,
                    "category": category,
                    "skill_match": [s for s in normalized_skills if category in SKILL_TO_CATEGORY.get(s, [])]
                })
                seen_urls.add(q["url"])
                count += 1
    
    # Sort by difficulty (Easy first, then Medium)
    difficulty_order = {"Easy": 0, "Medium": 1, "Hard": 2}
    questions.sort(key=lambda x: difficulty_order.get(x["difficulty"], 1))
    
    return questions[:15]  # Return max 15 questions


def get_all_categories() -> List[str]:
    """Get all available question categories."""
    return list(LEETCODE_QUESTIONS.keys())


def get_questions_by_category(category: str) -> List[Dict[str, Any]]:
    """Get all questions for a specific category."""
    return LEETCODE_QUESTIONS.get(category.lower(), [])
