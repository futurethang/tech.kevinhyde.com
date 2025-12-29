// Pub Trivia Game Logic
class TriviaGame {
  constructor() {
    this.questions = null;
    this.teams = [];
    this.currentRoundIndex = 0;
    this.currentQuestionIndex = 0;
    this.answerRevealed = false;
    this.timerInterval = null;
    this.timeRemaining = 0;

    this.init();
  }

  async init() {
    await this.loadQuestions();
    this.bindEvents();
    this.restoreState();
  }

  async loadQuestions() {
    try {
      const response = await fetch('trivia-questions.json');
      this.questions = await response.json();
    } catch (error) {
      console.error('Failed to load questions:', error);
      alert('Failed to load trivia questions. Please refresh the page.');
    }
  }

  bindEvents() {
    // Setup screen
    document.getElementById('add-team-btn').addEventListener('click', () => this.addTeamInput());
    document.getElementById('start-game-btn').addEventListener('click', () => this.startGame());

    // Game controls
    document.getElementById('prev-btn').addEventListener('click', () => this.previousQuestion());
    document.getElementById('reveal-btn').addEventListener('click', () => this.revealAnswer());
    document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());

    // Scoreboard
    document.getElementById('scoreboard-toggle').addEventListener('click', () => this.showScoreboard());
    document.getElementById('close-scoreboard').addEventListener('click', () => this.hideScoreboard());
    document.getElementById('continue-game').addEventListener('click', () => this.hideScoreboard());

    // Score modal
    document.getElementById('close-score-modal').addEventListener('click', () => this.hideScoreModal());
    document.getElementById('skip-scoring').addEventListener('click', () => this.skipScoring());

    // Round complete
    document.getElementById('next-round-btn').addEventListener('click', () => this.startNextRound());

    // Game complete
    document.getElementById('play-again-btn').addEventListener('click', () => this.resetGame());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  handleKeyboard(e) {
    if (!document.getElementById('game-screen').classList.contains('active')) return;
    if (document.querySelector('.modal:not(.hidden)')) return;

    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        if (!this.answerRevealed) {
          this.revealAnswer();
        }
        break;
      case 'ArrowRight':
        if (this.answerRevealed) this.nextQuestion();
        break;
      case 'ArrowLeft':
        this.previousQuestion();
        break;
      case 's':
        this.showScoreboard();
        break;
    }
  }

  addTeamInput() {
    const container = document.getElementById('teams-container');
    const teamCount = container.children.length + 1;

    const div = document.createElement('div');
    div.className = 'team-input';
    div.innerHTML = `
      <input type="text" class="team-name-input" placeholder="Team ${teamCount} Name" value="">
    `;
    container.appendChild(div);
  }

  startGame() {
    // Collect team names
    const inputs = document.querySelectorAll('.team-name-input');
    this.teams = [];

    inputs.forEach((input, index) => {
      const name = input.value.trim() || `Team ${index + 1}`;
      this.teams.push({
        name: name,
        score: 0
      });
    });

    if (this.teams.length < 2) {
      alert('Please add at least 2 teams!');
      return;
    }

    this.saveState();
    this.showScreen('game-screen');
    this.displayQuestion();
  }

  displayQuestion() {
    const rounds = this.questions.rounds;
    const round = rounds[this.currentRoundIndex];
    const question = round.questions[this.currentQuestionIndex];

    // Update header
    document.getElementById('round-name').textContent = round.name;
    document.getElementById('question-counter').textContent =
      `Q${this.currentQuestionIndex + 1} of ${round.questions.length}`;

    // Update meta
    document.getElementById('category').textContent = question.category;
    document.getElementById('question-type').textContent = this.formatType(question.type);
    document.getElementById('points').textContent = `${round.pointsPerQuestion} pts`;

    // Update question
    document.getElementById('question-text').textContent = question.question;

    // Handle multiple choice options
    const optionsContainer = document.getElementById('options-container');
    if (question.type === 'multiple-choice' && question.options) {
      optionsContainer.innerHTML = question.options
        .map((opt, i) => `<div class="option-btn" data-option="${i}">${String.fromCharCode(65 + i)}. ${opt}</div>`)
        .join('');
      optionsContainer.classList.remove('hidden');
    } else {
      optionsContainer.classList.add('hidden');
    }

    // Handle host hint
    const hintSection = document.getElementById('host-hint');
    const hintText = document.getElementById('hint-text');
    if (question.hostHint) {
      hintText.textContent = question.hostHint;
      hintSection.classList.remove('hidden');
    } else {
      hintSection.classList.add('hidden');
    }

    // Reset answer section
    document.getElementById('answer-section').classList.add('hidden');
    this.answerRevealed = false;
    document.getElementById('reveal-btn').textContent = 'Reveal Answer';
    document.getElementById('reveal-btn').classList.remove('btn-secondary');
    document.getElementById('reveal-btn').classList.add('btn-primary');

    // Update navigation buttons
    document.getElementById('prev-btn').disabled =
      this.currentRoundIndex === 0 && this.currentQuestionIndex === 0;

    // Lightning round styling
    const gameScreen = document.getElementById('game-screen');
    if (round.id === 'lightning') {
      gameScreen.classList.add('lightning-mode');
    } else {
      gameScreen.classList.remove('lightning-mode');
    }

    // Start timer
    this.startTimer(round.timePerQuestion);

    this.saveState();
  }

  formatType(type) {
    const types = {
      'open': 'Open Answer',
      'multiple-choice': 'Multiple Choice',
      'musical': 'Musical',
      'riddle': 'Riddle',
      'creative': 'Team Challenge'
    };
    return types[type] || type;
  }

  startTimer(seconds) {
    this.stopTimer();
    this.timeRemaining = seconds;

    const timerBar = document.getElementById('timer-bar');
    const timerText = document.getElementById('timer-text');

    timerBar.style.setProperty('--progress', '100%');
    timerText.textContent = `${seconds}s`;

    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      const progress = (this.timeRemaining / seconds) * 100;
      timerBar.style.setProperty('--progress', `${progress}%`);
      timerText.textContent = `${this.timeRemaining}s`;

      if (this.timeRemaining <= 0) {
        this.stopTimer();
        timerText.textContent = "Time!";
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  revealAnswer() {
    if (this.answerRevealed) {
      this.showScoreModal();
      return;
    }

    this.stopTimer();

    const round = this.questions.rounds[this.currentRoundIndex];
    const question = round.questions[this.currentQuestionIndex];

    // Show answer
    document.getElementById('answer-text').textContent = question.answer;
    document.getElementById('answer-section').classList.remove('hidden');

    // Show fun fact if available
    const funFactEl = document.getElementById('fun-fact');
    if (question.funFact) {
      funFactEl.textContent = question.funFact;
      funFactEl.classList.remove('hidden');
    } else {
      funFactEl.classList.add('hidden');
    }

    // Highlight correct answer for multiple choice
    if (question.type === 'multiple-choice' && question.options) {
      const correctIndex = question.options.indexOf(question.answer);
      const options = document.querySelectorAll('.option-btn');
      if (options[correctIndex]) {
        options[correctIndex].classList.add('correct');
      }
    }

    this.answerRevealed = true;
    document.getElementById('reveal-btn').textContent = 'Award Points';
    document.getElementById('reveal-btn').classList.remove('btn-primary');
    document.getElementById('reveal-btn').classList.add('btn-secondary');
  }

  showScoreModal() {
    const round = this.questions.rounds[this.currentRoundIndex];
    const points = round.pointsPerQuestion;

    const container = document.getElementById('score-buttons');
    container.innerHTML = this.teams.map((team, i) => `
      <button class="score-team-btn" data-team="${i}">
        <span>${team.name}</span>
        <span class="add-points">+${points} pts</span>
      </button>
    `).join('');

    // Bind events
    container.querySelectorAll('.score-team-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const teamIndex = parseInt(btn.dataset.team);
        this.awardPoints(teamIndex, points);
      });
    });

    document.getElementById('score-modal').classList.remove('hidden');
  }

  hideScoreModal() {
    document.getElementById('score-modal').classList.add('hidden');
  }

  awardPoints(teamIndex, points) {
    this.teams[teamIndex].score += points;
    this.hideScoreModal();
    this.saveState();

    // Show brief confirmation
    const btn = document.querySelector(`[data-team="${teamIndex}"]`);
    if (btn) {
      btn.style.background = 'rgba(74, 222, 128, 0.3)';
      setTimeout(() => {
        btn.style.background = '';
      }, 500);
    }
  }

  skipScoring() {
    this.hideScoreModal();
  }

  nextQuestion() {
    const round = this.questions.rounds[this.currentRoundIndex];

    if (this.currentQuestionIndex < round.questions.length - 1) {
      this.currentQuestionIndex++;
      this.displayQuestion();
    } else if (this.currentRoundIndex < this.questions.rounds.length - 1) {
      this.showRoundComplete();
    } else {
      this.showGameComplete();
    }
  }

  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.displayQuestion();
    } else if (this.currentRoundIndex > 0) {
      this.currentRoundIndex--;
      const prevRound = this.questions.rounds[this.currentRoundIndex];
      this.currentQuestionIndex = prevRound.questions.length - 1;
      this.displayQuestion();
    }
  }

  showRoundComplete() {
    this.stopTimer();
    const roundScores = document.getElementById('round-scores');
    roundScores.innerHTML = this.renderScoreboard();

    const nextRound = this.questions.rounds[this.currentRoundIndex + 1];
    document.getElementById('next-round-btn').textContent =
      nextRound ? `Start: ${nextRound.name}` : 'See Final Results';

    document.getElementById('round-complete-title').textContent =
      `${this.questions.rounds[this.currentRoundIndex].name} Complete!`;

    this.showScreen('round-complete-screen');
  }

  startNextRound() {
    this.currentRoundIndex++;
    this.currentQuestionIndex = 0;
    this.showScreen('game-screen');
    this.displayQuestion();
  }

  showGameComplete() {
    this.stopTimer();

    // Sort teams by score
    const sortedTeams = [...this.teams].sort((a, b) => b.score - a.score);
    const winner = sortedTeams[0];
    const isTie = sortedTeams.filter(t => t.score === winner.score).length > 1;

    document.getElementById('final-standings').innerHTML = this.renderScoreboard(true);

    const announcement = document.getElementById('winner-announcement');
    if (isTie) {
      const tiedTeams = sortedTeams.filter(t => t.score === winner.score);
      announcement.innerHTML = `It's a tie! <span class="winner-name">${tiedTeams.map(t => t.name).join(' & ')}</span> are the champions!`;
    } else {
      announcement.innerHTML = `<span class="winner-name">${winner.name}</span> wins with ${winner.score} points!`;
    }

    this.showScreen('game-complete-screen');
    this.clearState();
  }

  showScoreboard() {
    document.getElementById('scoreboard-content').innerHTML = this.renderScoreboard();
    document.getElementById('scoreboard-modal').classList.remove('hidden');
  }

  hideScoreboard() {
    document.getElementById('scoreboard-modal').classList.add('hidden');
  }

  renderScoreboard(showRank = false) {
    const sortedTeams = [...this.teams]
      .map((team, index) => ({ ...team, originalIndex: index }))
      .sort((a, b) => b.score - a.score);

    const maxScore = sortedTeams.length > 0 ? sortedTeams[0].score : 0;

    return sortedTeams.map((team, i) => {
      const isLeader = team.score === maxScore && maxScore > 0;
      const rank = showRank ? `<span class="rank">${i + 1}.</span> ` : '';
      const crown = isLeader ? '<span class="crown">👑</span>' : '';

      return `
        <div class="score-row ${isLeader ? 'leader' : ''}">
          <span class="team-name">${rank}${team.name}${crown}</span>
          <span class="team-score">${team.score}</span>
        </div>
      `;
    }).join('');
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  resetGame() {
    this.teams.forEach(team => team.score = 0);
    this.currentRoundIndex = 0;
    this.currentQuestionIndex = 0;
    this.clearState();
    this.showScreen('setup-screen');
  }

  // State persistence
  saveState() {
    const state = {
      teams: this.teams,
      currentRoundIndex: this.currentRoundIndex,
      currentQuestionIndex: this.currentQuestionIndex
    };
    localStorage.setItem('triviaGameState', JSON.stringify(state));
  }

  restoreState() {
    const saved = localStorage.getItem('triviaGameState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.teams && state.teams.length > 0) {
          const resume = confirm('Resume previous game?');
          if (resume) {
            this.teams = state.teams;
            this.currentRoundIndex = state.currentRoundIndex || 0;
            this.currentQuestionIndex = state.currentQuestionIndex || 0;
            this.showScreen('game-screen');
            this.displayQuestion();
          } else {
            this.clearState();
          }
        }
      } catch (e) {
        this.clearState();
      }
    }
  }

  clearState() {
    localStorage.removeItem('triviaGameState');
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.triviaGame = new TriviaGame();
});
