from pathlib import Path


path = Path("/Users/nm/Desktop/presentation/hiring_copilot_presentation (2).html")
html = path.read_text()

start = html.find("/* ── REVEAL ── */")
end = html.find("\n\n/* ── SHARED PRIMITIVES ── */", start)
if start < 0 or end < 0:
    raise SystemExit("reveal css bounds not found")

reveal_css = """/* ── 3D SLIDE REVEAL ── */
.rv{opacity:0;transform:translateY(34px);transition:opacity .62s cubic-bezier(.16,1,.3,1),transform .62s cubic-bezier(.16,1,.3,1)}
.rv.in{opacity:1;transform:none}
section{perspective:1600px}
section > .wrap,section > .diagram-page,#s1 .left,#s1 .right,#s13 .inner{will-change:transform,opacity,filter;transform-origin:center 62%;backface-visibility:hidden}
section:not(.is-active) > .wrap,section:not(.is-active) > .diagram-page,section:not(.is-active)#s1 .left,section:not(.is-active)#s1 .right,section:not(.is-active)#s13 .inner{opacity:0;transform:translate3d(0,130px,-760px) rotateX(18deg) scale(.62);filter:blur(16px)}
section.is-active > .wrap,section.is-active > .diagram-page,section.is-active#s1 .left,section.is-active#s1 .right,section.is-active#s13 .inner{animation:slideFlyIn3D 1.05s cubic-bezier(.13,1.04,.28,1) both}
@keyframes slideFlyIn3D{
  0%{opacity:0;transform:translate3d(0,150px,-820px) rotateX(20deg) scale(.58);filter:blur(18px)}
  45%{opacity:1;transform:translate3d(0,42px,-145px) rotateX(5deg) scale(.94);filter:blur(4px)}
  72%{opacity:1;transform:translate3d(0,-8px,34px) rotateX(-1deg) scale(1.015);filter:blur(0)}
  100%{opacity:1;transform:translate3d(0,0,0) rotateX(0) scale(1);filter:blur(0)}
}
.d1{transition-delay:.15s}.d2{transition-delay:.25s}.d3{transition-delay:.35s}.d4{transition-delay:.45s}.d5{transition-delay:.55s}.d6{transition-delay:.65s}
@media(prefers-reduced-motion:reduce){section > .wrap,section > .diagram-page,#s1 .left,#s1 .right,#s13 .inner,.rv{animation:none!important;transition:none!important;transform:none!important;filter:none!important;opacity:1!important}}"""

html = html[:start] + reveal_css + html[end:]

html = html.replace("  s.classList.add(i%3===1?'from-bottom':'from-back');\n", "")

old_replay = """function replaySlide(section){
  secs.forEach(s=>{
    if(s!==section){
      s.classList.remove('is-active');
      s.querySelectorAll('.rv.in').forEach(el=>el.classList.remove('in'));
    }
  });
  section.classList.remove('is-active');
  section.querySelectorAll('.rv.in').forEach(el=>el.classList.remove('in'));
  void section.offsetWidth;
  section.classList.add('is-active');
  requestAnimationFrame(()=>{
    section.querySelectorAll('.rv').forEach(el=>el.classList.add('in'));
  });
}
"""

new_replay = """function animatedShells(section){
  return [
    section.querySelector(':scope > .wrap'),
    section.querySelector(':scope > .diagram-page'),
    section.matches('#s1') && section.querySelector('.left'),
    section.matches('#s1') && section.querySelector('.right'),
    section.matches('#s13') && section.querySelector('.inner')
  ].filter(Boolean);
}

function replaySlide(section){
  secs.forEach(s=>{
    s.classList.remove('is-active');
    s.querySelectorAll('.rv.in').forEach(el=>el.classList.remove('in'));
    animatedShells(s).forEach(el=>{ el.style.animation='none'; });
  });
  void section.offsetWidth;
  animatedShells(section).forEach(el=>{ el.style.animation=''; });
  section.classList.add('is-active');
  requestAnimationFrame(()=>{
    section.querySelectorAll('.rv').forEach(el=>el.classList.add('in'));
  });
}
"""

if old_replay not in html:
    raise SystemExit("replaySlide block not found")

html = html.replace(old_replay, new_replay)
path.write_text(html)
