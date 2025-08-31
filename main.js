// Wait for the DOM and MathJax to be fully loaded and ready before starting the app
window.addEventListener('load', () => {
  // Wait for MathJax to be fully loaded and ready before starting the app
MathJax.startup.promise.then(() => {
  
    const APP_KEY = 'SATGAME_V1';

    const compliments = [
      "You're doing good!", "Bravo!", "Excellent!", "Perfect! You're a genius!"
    ];

    function loadState(){
      try{
        const raw = localStorage.getItem(APP_KEY);
        if(raw){ 
            const state = JSON.parse(raw);
            if (!state.highScores) {
                state.highScores = { Normal: 0, Faster: 0, Reverse: 0 };
            }
            return state;
        }
      }catch(e){ console.error(e); }
      const state = {
        theme: 'dark', streak: { days: 0, last: null }, plays: 5, badges: {}, progress: {}, history: [],
        highScores: { Normal: 0, Faster: 0, Reverse: 0 }
      };
      saveState(state);
      return state;
    }
    function saveState(state){
      localStorage.setItem(APP_KEY, JSON.stringify(state));
    }
    let STATE = loadState();

    const app = document.getElementById('app');
    const toast = document.getElementById('toast');
    function showToast(msg){
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(()=> toast.classList.remove('show'), 1200);
    }

    function setTheme(theme){
      document.documentElement.classList.toggle('dark', theme==='dark');
      STATE.theme = theme; saveState(STATE);
      document.getElementById('toggleTheme').textContent = theme==='dark' ? '☀️' : '🌙';
    }
    
    function renderMath() {
      if (window.MathJax) {
        MathJax.typesetPromise([app]).catch((err) => console.log('MathJax typeset error:', err));
      }
    }

    function route(name, params={}){
      if(name==='dashboard') renderDashboard();
      if(name==='subcat') renderSubcategories(params.category);
      if(name==='levels') renderLevels(params.category, params.subcat);
      if(name==='quiz') renderQuiz(params.category, params.subcat, params.levelIndex);
      if(name==='review') renderReview(params.result, params.context);
      if(name==='game') renderFullscreenGame();
    }

    function renderDashboard(){
      const totals = computeTotals();
      const weaknesses = computeWeaknesses();
      const categoryIcons = { 'Logical Reasoning & Analytical': '🧠', 'Verbal': '📚', 'Quantitative': '🔢' };

      app.innerHTML = `
        <div class="header dashboard-header">
          <div class="h1">Dashboard</div>
          <div class="row">
            <span class="pill">Plays: <b id="playsBank">${STATE.plays||0}</b></span>
            <span class="pill">Daily streak: <b>${STATE.streak.days||0}</b></span>
          </div>
        </div>

        <div class="grid cols-3">
          ${Object.keys(SAT_DB.categories).map(cat=>`
            <div class="card click" data-cat="${cat}">
              <div class="h2">${categoryIcons[cat] || ''} ${cat}</div>
              <div class="muted">${totals.byCategory[cat]||0}/${totals.maxByCategory[cat]} levels done</div>
            </div>`).join('')}
        </div>
        
        <div class="card" id="progress-focus-card" style="margin-top:20px">
          <div class="h2">Progress & Focus</div>
          <div class="progress-grid">
            ${Object.keys(SAT_DB.categories).map(cat=>{
              const pct = Math.round(100 * (totals.byCategory[cat] || 0) / (totals.maxByCategory[cat] || 1));
              return `
              <div class="progress-item">
                  <div class="progress-circle" style="--p:${pct};">${pct}%</div>
                  <div class="progress-label">
                      <div>${cat}</div>
                      <div class="muted">${totals.byCategory[cat]||0}/${totals.maxByCategory[cat]}</div>
                  </div>
              </div>`;
            }).join('')}
          </div>
          <div class="focus-area">
            <div class="h2" style="margin-top: 16px;">🎯 Focus Area</div>
            ${weaknesses.length > 0 ? `
              <div class="focus-grid">
                ${weaknesses.map(w => `
                  <details class="focus-dropdown">
                    <summary class="focus-summary">
                      <div>
                        <b>${w.subcat}</b>
                        <div class="muted">Avg. Score: ${w.avgScore.toFixed(1)}/5</div>
                      </div>
                      <span class="arrow"></span>
                    </summary>
                    <div class="focus-details">
                      ${w.failedLevels.map(l => `
                        <div class="level-chip">
                          <div class="level-chip-info">L${l.levelIndex + 1} (${l.difficulty}) - Score: ${l.score}/5</div>
                          <button class="start practice-btn" data-cat="${w.category}" data-subcat="${w.subcat}" data-level="${l.levelIndex}">Practice</button>
                        </div>
                      `).join('')}
                    </div>
                  </details>
                `).join('')}
              </div>
            ` : `<div class="muted">Play some levels to discover your focus areas!</div>`}
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <div class="header" style="margin-bottom:0;">
            <div class="h2">Recent Results</div>
            <button class="ghost" id="toggleResults" style="padding: 4px 10px; font-size: 12px;">Show</button>
          </div>
          <div class="muted">Last 5 level attempts</div>
          <div class="grid hidden" id="resultsContainer">
            ${(STATE.history.slice(-5).reverse()).map(h=>`
              <div class="level-chip">
                <div class="level-chip-info">
                  <div><b>${h.subcat}</b> — L${h.levelIndex+1} (${h.difficulty})</div>
                  <div class="muted">${h.score}/5 • ${h.passed? 'Passed' : 'Retry'}</div>
                </div>
                <span class="badge">${new Date(h.time).toLocaleDateString()}</span>
              </div>
            `).join('') || '<div class="muted">No attempts yet.</div>'}
          </div>
        </div>
      `;
      renderMath();
      app.querySelectorAll('[data-cat]').forEach(el=> el.addEventListener('click', ()=> route('subcat',{category:el.dataset.cat})));
      app.querySelectorAll('.practice-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            route('quiz', { category: btn.dataset.cat, subcat: btn.dataset.subcat, levelIndex: Number(btn.dataset.level) });
        });
      });
      document.getElementById('toggleResults').addEventListener('click', (e) => {
          const container = document.getElementById('resultsContainer');
          container.classList.toggle('hidden');
          e.target.textContent = container.classList.contains('hidden') ? 'Show' : 'Hide';
      });
    }

    function renderSubcategories(category){
      const subcats = Object.keys(SAT_DB.categories[category].subcategories);
      app.innerHTML = `
        <div class="header">
          <div class="row"><button class="ghost" id="backDash">← Back</button><div class="h1">${category}</div></div>
        </div>
        <div class="grid cols-2">
          ${subcats.map(sc=>{
            const done = getCompletedCount(sc);
            const pct = Math.round(100*done/20);
            return `
              <div class="card click" data-sc="${sc}">
                <div class="h2">${sc}</div>
                <div class="muted">${done}/20 levels completed</div>
                <div class="progress"><span style="width:${pct}%"></span></div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      renderMath();
      document.getElementById('backDash').addEventListener('click', ()=> route('dashboard'));
      app.querySelectorAll('[data-sc]').forEach(el=> el.addEventListener('click', ()=> route('levels',{category, subcat:el.dataset.sc})));
    }

    function renderLevels(category, subcat){
      const completed = (STATE.progress[subcat]?.completedLevels) || [];
      app.innerHTML = `
        <div class="header">
          <div class="row"><button class="ghost" id="backSub">← Back</button><div class="h1">${subcat}</div></div>
          <div class="row"><span class="pill">Badges: ${renderBadges(subcat).join(' ')||'<span class="muted">none</span>'}</span></div>
        </div>
        <div class="grid cols-2">
          ${Array.from({length:20}).map((_,i)=>{
            const idx=i+1;
            const diff = difficultyForLevel(idx);
            const done = completed.includes(idx);
            const bestScore = STATE.progress[subcat]?.bestScores?.[idx];
            const hasQs = hasQuestionsForLevel(subcat, i);
            return `
              <div class="level-chip ${diff.toLowerCase()}">
                <div class="level-chip-info">L${idx} — ${diff} ${bestScore !== undefined ? `(Best: ${bestScore}/5)` : ''}</div>
                <div class="row">
                  ${done?'<span class="badge">Done</span>':''}
                  ${hasQs 
                    ? `<button class="start" data-lvl="${idx}">Start</button>`
                    : `<button class="start" disabled>Soon</button>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      renderMath();
      document.getElementById('backSub').addEventListener('click', ()=> route('subcat',{category}));
      app.querySelectorAll('[data-lvl]').forEach(btn=> btn.addEventListener('click', ()=> route('quiz',{category, subcat, levelIndex: Number(btn.dataset.lvl)-1})));
    }

    function renderQuiz(category, subcat, levelIndex){
      const questions = sampleQuestions(subcat, levelIndex);
      if (!questions || questions.length === 0) {
          alert("Sorry, there are no questions available for this level yet.");
          route('levels', { category, subcat });
          return;
      }
      let current=0, correct=0, streak=0;
      const answersChosen = [];
      const diff = difficultyForLevel(levelIndex+1);

      function draw(){
        if (current >= questions.length) { finish(); return; }
        const q = questions[current];
        app.innerHTML = `
          <div class="header">
            <div class="row"><button class="ghost" id="backLvls">← Levels</button><div class="h1">${subcat} • L${levelIndex+1} <span class="badge">${diff}</span></div></div>
            <div class="row"><span class="pill">Streak: <b>${streak}</b></span></div>
          </div>
          <div class="card">
            <div class="h2">${q.q}</div>
            <div class="answers">${q.options.map((opt,i)=>`<button class="btn" data-i="${i}">${opt}</button>`).join('')}</div>
            <div class="row" style="margin-top:8px">
              <span class="muted">Question ${current+1}/${questions.length}</span>
              <span class="muted">Correct: ${correct}</span>
            </div>
          </div>
        `;
        renderMath(); 
        document.getElementById('backLvls').addEventListener('click', ()=> route('levels',{category, subcat}));
        app.querySelectorAll('[data-i]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const i = Number(btn.dataset.i);
            if(answersChosen[current]!=null) return;
            answersChosen[current]=i;
            const right = (i===questions[current].answerIndex);
            btn.classList.add(right ? 'correct' : 'incorrect');
            if(right){
              correct++; streak++;
              if(streak>=2) showToast(compliments[Math.min(streak-2, compliments.length-1)]);
            } else { streak=0; }
            setTimeout(()=>{
              if(current < questions.length - 1){ current++; draw(); }
              else{ finish(); }
            }, 450);
          });
        });
      }

      function finish(){
        const passed = correct >= 3;
        let playsEarned = 0;
        if (passed) {
            if (correct === 5) playsEarned = 3;
            else if (correct === 4) playsEarned = 2;
            else if (correct === 3) playsEarned = 1;
        }

        STATE.plays += playsEarned;
        STATE.progress[subcat] = STATE.progress[subcat] || { completedLevels: [], bestScores:{}, diffDone:{Easy:0,Medium:0,Hard:0,Mastery:0} };
        if(passed && !STATE.progress[subcat].completedLevels.includes(levelIndex+1)){
          STATE.progress[subcat].completedLevels.push(levelIndex+1);
          STATE.progress[subcat].diffDone[diff]++;
        }
        STATE.progress[subcat].bestScores[levelIndex+1] = Math.max(STATE.progress[subcat].bestScores[levelIndex+1]||0, correct );
        if((STATE.progress[subcat].diffDone[diff] || 0) >= 5){
          STATE.badges[subcat] = STATE.badges[subcat] || {};
          STATE.badges[subcat][diff]=true;
        }
        applyDailyStreak();
        STATE.history.push({ subcat, levelIndex, difficulty:diff, score:correct, passed, time: Date.now() });
        saveState(STATE);

        const canPlayGame = STATE.plays > 0 && passed;

        app.innerHTML = `
          <div class="card">
            <div class="h1">${passed? 'Level Passed 🎉' : 'Level Result'}</div>
            <p>You scored <b>${correct}/${questions.length}</b>. ${passed? 'You earned plays for the mini-game!' : 'Score at least 3 to pass.'}</p>
            <div class="row"><span class="pill">Plays earned: <b>${playsEarned}</b></span><span class="pill">Total plays: <b>${STATE.plays}</b></span></div>
            <div class="row" style="margin-top:8px">
              <button id="review">Review</button>
              <button class="ghost" id="retry">Retry Level</button>
              <button id="launchGame" ${!canPlayGame ? 'disabled' : ''}>Play Mini‑game</button>
              <button class="ghost" id="toLevels">Back to Levels</button>
            </div>
            ${!passed ? "<p class='muted' style='margin-top:10px;'>You must score at least 3/5 to play the mini-game.</p>" : ""}
          </div>
        `;
        document.getElementById('review').addEventListener('click', ()=>{
          const result = questions.map((q,idx)=>({ q:q.q, options:q.options, correct:q.answerIndex, chosen:answersChosen[idx], explanation:q.explanation }));
          route('review', { result, context: { category, subcat, levelIndex } });
        });
        document.getElementById('retry').addEventListener('click', ()=> route('quiz',{category, subcat, levelIndex}));
        document.getElementById('toLevels').addEventListener('click', ()=> route('levels',{category, subcat}));
        const launchBtn = document.getElementById('launchGame');
        if (launchBtn && !launchBtn.disabled) {
            launchBtn.addEventListener('click', () => route('game'));
        }
      }
      draw();
    }

    function renderReview(result, context){
      app.innerHTML = `
        <div class="header">
          <div class="row"><button class="ghost" id="backLevels">← Back</button><div class="h1">Answer Review</div></div>
        </div>
        <div class="grid">
          ${result.map((r,i)=>`
            <div class="card">
              <div class="h2">${i + 1}. ${r.q}</div>
              <div class="review-answers">
                ${r.options.map((opt, optIndex) => {
                  let className = '';
                  if (optIndex === r.correct) className = 'correct';
                  else if (optIndex === r.chosen) className = 'incorrect';
                  return `<div class="review-option ${className}">${opt}${optIndex === r.chosen ? '<span class="your-pick">Your Pick</span>' : ''}</div>`;
                }).join('')}
              </div>
              <div class="explanation"><strong>Explanation:</strong> ${r.explanation || 'N/A'}</div>
            </div>
          `).join('')}
        </div>
      `;
      renderMath();
      document.getElementById('backLevels').addEventListener('click', ()=> route('levels', context));
    }
    
    function renderFullscreenGame() {
      // **FIXED**: Check for plays before even creating the modal
      if (STATE.plays <= 0) {
          showToast("You have no plays left. Pass a level to earn more!");
          return;
      }

      const modal = document.createElement('div');
      modal.className = 'game-fullscreen-modal';
      document.body.appendChild(modal);

      const openFullscreen = () => {
        if (modal.requestFullscreen) modal.requestFullscreen();
        else if (modal.webkitRequestFullscreen) modal.webkitRequestFullscreen();
      };
      
      const close = () => {
          Piano.destroy();
          if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          if(document.body.contains(modal)) document.body.removeChild(modal);
          const playsBankEl = document.getElementById('playsBank');
          if (playsBankEl) playsBankEl.textContent = STATE.plays;
          document.removeEventListener('fullscreenchange', handleFullscreenChange);
          document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      };
      
      const handleFullscreenChange = () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          close();
        }
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

      let selectedMode = null;
      const modes = ["Normal", "Faster", "Reverse"];

      function renderPreGame() {
          modal.innerHTML = `
            <div class="pre-game-container">
                <div class="pre-game-step active">
                    <h1>Choose a Mode</h1>
                    <div class="choices">${modes.map(mode => `<button class="choice-btn mode-choice" data-mode="${mode}">${mode}<span class="high-score">Best: ${STATE.highScores[mode] || 0}</span></button>`).join('')}</div>
                </div>
            </div>
            <button class="game-close-btn">&times;</button>`;
      }

      modal.addEventListener('click', (e) => {
          if (e.target.classList.contains('game-close-btn')) close();
          else if (e.target.closest('.mode-choice')) {
              selectedMode = e.target.closest('.mode-choice').dataset.mode;
              launchGame();
          }
      });
      
      function launchGame() {
          openFullscreen();
          modal.innerHTML = `
              <button class="game-close-btn">&times;</button>
              <div class="game-container">
                  <div id="stars-animation-container"></div>
                  <div id="piano-board"></div>
                  <div id="game-overlay">
                      <div id="game-start-text"></div>
                      <button id="game-start-btn"></button>
                  </div>
              </div>`;
          modal.querySelector('.game-close-btn').addEventListener('click', close);
          
          setTimeout(() => {
            Piano.init(modal.querySelector('#piano-board'), {
                overlay: modal.querySelector('#game-overlay'),
                startText: modal.querySelector('#game-start-text'),
                starsContainer: modal.querySelector('#stars-animation-container')
            }, 
            { 
                mode: selectedMode,
                highScore: STATE.highScores[selectedMode] || 0,
                initialPlays: STATE.plays
            }, 
            (gameResult) => {
                STATE.plays = gameResult.playsLeft;
                if (gameResult.finalScore > (STATE.highScores[gameResult.gameMode] || 0)) {
                    STATE.highScores[gameResult.gameMode] = gameResult.finalScore;
                }
                saveState(STATE);
            });
          }, 100);
      }

      renderPreGame();
    }

    // ---------- Helpers ----------
    function difficultyForLevel(lvl){
      if(lvl >= 16) return 'Mastery';
      if(lvl >= 11) return 'Hard';
      if(lvl >= 6) return 'Medium';
      return 'Easy';
    }
    
    function hasQuestionsForLevel(subcat, levelIndex) {
      const diff = difficultyForLevel(levelIndex + 1);
      const scObj = findSubcat(subcat);
      return (scObj.questions?.items || []).some(q => q.difficulty === diff);
    }
    
    function sampleQuestions(subcat, levelIndex){
      const diff = difficultyForLevel(levelIndex+1);
      const scObj = findSubcat(subcat);
      const items = (scObj.questions?.items || []).filter(q=> q.difficulty===diff);
      if (items.length === 0) return [];
      const pool = items.length >= 5 ? items : items;
      const indices = new Set();
      while(indices.size < Math.min(5, pool.length)) indices.add(Math.floor(Math.random()*pool.length));
      return Array.from(indices).map(i=> pool[i]);
    }

    function findSubcat(subcatName){
      for(const catName in SAT_DB.categories){
        if(SAT_DB.categories[catName].subcategories[subcatName]) {
          return { ...SAT_DB.categories[catName].subcategories[subcatName], category: catName };
        }
      }
      return { questions:{items:[]}, category: null };
    }
    function renderBadges(subcat){
      const b = STATE.badges[subcat]||{};
      return ['Easy','Medium','Hard','Mastery'].map(d=> b[d]? `<span class="badge">${d}</span>`:'').filter(Boolean);
    }
    function getCompletedCount(subcat){
      return (STATE.progress[subcat]?.completedLevels?.length) || 0;
    }

    function computeTotals(){
      const byCategory = {};
      const maxByCategory = {}; 
      for(const catName in SAT_DB.categories){
        let max=0, done=0;
        for(const sc in SAT_DB.categories[catName].subcategories){ 
            max += 20; 
            done += getCompletedCount(sc); 
        }
        byCategory[catName]=done;
        maxByCategory[catName] = max;
      }
      return { byCategory, maxByCategory };
    }
    
    function computeWeaknesses(){
        const performance = {};
        STATE.history.forEach(h => {
            if (!performance[h.subcat]) performance[h.subcat] = { totalScore: 0, attempts: 0, failedLevels: [] };
            performance[h.subcat].totalScore += h.score;
            performance[h.subcat].attempts++;
            if (!h.passed) {
                const existing = performance[h.subcat].failedLevels.findIndex(l => l.levelIndex === h.levelIndex);
                if (existing > -1) performance[h.subcat].failedLevels[existing] = h;
                else performance[h.subcat].failedLevels.push(h);
            }
        });
        const weaknesses = [];
        for (const subcat in performance) {
            if (performance[subcat].attempts > 0) {
                const avgScore = performance[subcat].totalScore / performance[subcat].attempts;
                if (avgScore < 3.5 && performance[subcat].failedLevels.length > 0) {
                    const subcatInfo = findSubcat(subcat);
                    weaknesses.push({ subcat, category: subcatInfo.category, avgScore, failedLevels: performance[subcat].failedLevels });
                }
            }
        }
        return weaknesses.sort((a, b) => a.avgScore - b.avgScore);
    }
    function applyDailyStreak(){
      const today = new Date(); today.setHours(0,0,0,0);
      const last = STATE.streak.last ? new Date(STATE.streak.last) : null;
      if(!last){ STATE.streak.days=1; }
      else{
        last.setHours(0,0,0,0);
        const diffDays = Math.round((today - last) / 86400000);
        if(diffDays===1) STATE.streak.days++;
        else if(diffDays>1) STATE.streak.days=1;
      }
      STATE.streak.last = Date.now();
    }
    
    // Initialize App
    setTheme(STATE.theme);
    document.getElementById('toggleTheme').addEventListener('click',()=>{
      setTheme( (STATE.theme==='dark') ? 'light' : 'dark' );
    });
    route('dashboard');
    
  });
});
