/* All lesson explanations and answers are static HTML; enhancement stays in memory. */
(() => {
  'use strict';
  const questions = [...document.querySelectorAll('.question')];
  const attempted = new Set();
  const correct = new Set();
  const progress = document.querySelector('.quiz-progress');
  function showProgress() {
    progress.textContent = `已嘗試 ${attempted.size}／${questions.length} 題，目前 ${correct.size} 題選到合適答案。可以看原因、再試一次。`;
  }
  for (const question of questions) {
    question.querySelectorAll('input').forEach(input => { input.checked = false; });
    const feedback = question.querySelector('.answer-feedback');
    question.querySelector('.check-answer').addEventListener('click', () => {
      const selected = question.querySelector('input:checked');
      if (!selected) {
        feedback.textContent = '先選一個答案，或請大人陪你說一說想法。';
        feedback.dataset.result = 'pending';
        return;
      }
      attempted.add(question.dataset.question);
      const isCorrect = selected.value === question.dataset.answer;
      if (isCorrect) correct.add(question.dataset.question); else correct.delete(question.dataset.question);
      feedback.dataset.result = isCorrect ? 'correct' : 'retry';
      feedback.textContent = `${isCorrect ? '你找到了！' : '再想一想。'}${question.querySelector('.explanation').textContent}`;
      showProgress();
    });
    question.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      feedback.textContent = "";
      correct.delete(question.dataset.question);
      if (attempted.has(question.dataset.question)) showProgress();
    }));
  }
  document.querySelector('.reset-quiz').addEventListener('click', () => {
    questions.forEach(question => {
      question.querySelectorAll('input').forEach(input => { input.checked = false; });
      question.querySelectorAll('details').forEach(detail => { detail.open = false; });
      question.querySelector('.answer-feedback').textContent = ''; 
    });
    attempted.clear(); correct.clear(); showProgress();
    questions[0]?.querySelector('input')?.focus();
  });
  const checks = [...document.querySelectorAll('.self-checks input')];
  checks.forEach(input => { input.checked = false; });
  checks.forEach(input => input.addEventListener('change', () => {
    const count = checks.filter(item => item.checked).length;
    document.querySelector('.self-progress').textContent = `目前勾選 ${count}／${checks.length} 項。${count === checks.length ? '把其中一項做給陪學大人看吧！' : '慢慢來，挑一項繼續練。'}`;
  }));
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  document.querySelectorAll('[data-count-board]').forEach((host, boardIndex) => {
    const title = element('h3', '動手放一放：十格板');
    const description = element('p', '點一格放一顆圓點，再點一次拿走。從上排左邊開始，一格一顆。');
    const board = element('div', '', 'ten-frame');
    board.setAttribute('role', 'group'); board.setAttribute('aria-label', '十格板，兩排各五格');
    const readout = element('p', '', 'count-readout');
    readout.setAttribute('role','status'); readout.setAttribute('aria-live','polite');
    const controls = element('div', '', 'count-controls');
    const label = element('label', '我想放幾顆？');
    const select = element('select'); select.id = `count-target-${boardIndex}`; label.htmlFor = select.id;
    for(let n=1;n<=10;n++){const option=element('option',String(n));option.value=String(n);select.append(option);}
    select.value='5';
    const verify = element('button', '數一數，檢查'); verify.type='button';
    const clear = element('button', '全部拿走'); clear.type='button';
    const outcome = element('p'); outcome.setAttribute('role','status'); outcome.setAttribute('aria-live','polite');
    const occupied = new Set();
    function update() {
      readout.textContent = occupied.size ? `現在有 ${occupied.size} 顆圓點。最後數到 ${occupied.size}，就是全部的數量。` : '現在沒有圓點。選一格放入第一顆吧。';
      outcome.textContent='';
    }
    for(let i=0;i<10;i++){
      const button=element('button','＋','count-cell');button.type='button';
      button.setAttribute('aria-label',`第 ${i+1} 格，空格，點選放入一顆`);button.setAttribute('aria-pressed','false');
      button.addEventListener('click',()=>{
        if(occupied.has(i))occupied.delete(i);else occupied.add(i);
        const filled=occupied.has(i);button.textContent=filled?'●':'＋';button.setAttribute('aria-pressed',String(filled));
        button.setAttribute('aria-label',`第 ${i+1} 格，${filled?'有一顆，點選拿走':'空格，點選放入一顆'}`);update();
      });board.append(button);
    }
    verify.addEventListener('click',()=>{
      const target=Number(select.value);
      outcome.textContent=occupied.size===target?`做到了！一格一顆，共 ${target} 顆。試著換個位置，數量會改變嗎？`:`目標是 ${target} 顆，現在有 ${occupied.size} 顆。請一格一格再數一次，放入或拿走圓點。`;
    });
    select.addEventListener('change',()=>{outcome.textContent='換了一個目標，試著放放看。';});
    clear.addEventListener('click',()=>{occupied.clear();[...board.children].forEach((b,i)=>{b.textContent='＋';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',`第 ${i+1} 格，空格，點選放入一顆`);});update();});
    controls.append(label,select,verify,clear);host.replaceChildren(title,description,board,readout,controls,outcome);update();
  });
  let printState=null;
  window.addEventListener('beforeprint',()=>{
    if(printState)return;
    printState=[...document.querySelectorAll('details')].map(detail=>[detail,detail.open]);
    printState.forEach(([detail])=>{detail.open=true;});
  });
  window.addEventListener('afterprint',()=>{
    if(printState)printState.forEach(([detail,open])=>{detail.open=open;});printState=null;
  });
  document.querySelector('.lesson-print').addEventListener('click',()=>window.print());
  document.documentElement.classList.add('lesson-ready');
})();
