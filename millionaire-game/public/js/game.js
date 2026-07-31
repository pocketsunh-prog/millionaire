class MillionaireGame {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.lights = [];
    this.particles = [];
    this.stars = null;
    this.questionRing = null;
    this.glowSphere = null;
    this.clock = new THREE.Clock();

    this.currentQuestionIndex = 0;
    this.questions = [];
    this.prizeLevels = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
    this.lifelines = { '5050': true, audience: true, phone: true };
    this.selectedAnswer = null;
    this.isAnswering = false;
    this.playerName = 'Player';
    this.category = 'mixed';

    this.init();
    this.setupUI();
    this.loadCategories();
    this.setupAudio();
    this.checkAuth();
  }

  async checkAuth() {
    const loggedIn = await window.authManager.init();
    if (loggedIn) {
      this.showScreen('main-menu');
      this.updateUserBar();
    } else {
      this.showScreen('auth-screen');
    }
  }

  updateUserBar() {
    const bar = document.getElementById('user-bar');
    const adminBtn = document.getElementById('btn-admin');
    if (window.authManager.isLoggedIn()) {
      bar.classList.remove('hidden');
      document.getElementById('user-avatar').textContent = window.authManager.user.avatar;
      document.getElementById('user-name').textContent = window.authManager.user.username;
      document.getElementById('mini-wins').textContent = window.authManager.user.total_wins;
      document.getElementById('mini-best').textContent = window.authManager.user.best_score.toLocaleString();
      adminBtn.classList.toggle('hidden', !window.authManager.isAdmin());
    } else {
      bar.classList.add('hidden');
      adminBtn.classList.add('hidden');
    }
  }

  setupAudio() {
    const initAudio = () => {
      window.audioManager.init();
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);

    document.getElementById('btn-music').addEventListener('click', (e) => {
      e.stopPropagation();
      const enabled = window.audioManager.toggleMusic();
      e.currentTarget.classList.toggle('muted', !enabled);
      if (enabled && document.getElementById('game-screen').classList.contains('active')) {
        window.audioManager.startBackgroundMusic();
      }
    });

    document.getElementById('btn-sfx').addEventListener('click', (e) => {
      e.stopPropagation();
      const enabled = window.audioManager.toggleSfx();
      e.currentTarget.classList.toggle('muted', !enabled);
    });
  }

  init() {
    const canvas = document.getElementById('game-canvas');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a2e, 0.015);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2, 12);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0a2e, 1);

    this.createLights();
    this.createStarField();
    this.createMainStage();
    this.createGlowEffects();
    this.createParticles();

    window.addEventListener('resize', () => this.onResize());

    this.animate();
  }

  createLights() {
    const ambientLight = new THREE.AmbientLight(0x4040ff, 0.3);
    this.scene.add(ambientLight);

    const spotLight1 = new THREE.SpotLight(0xffd700, 2);
    spotLight1.position.set(0, 15, 5);
    spotLight1.angle = Math.PI / 4;
    spotLight1.penumbra = 0.5;
    this.scene.add(spotLight1);

    const spotLight2 = new THREE.SpotLight(0x4040ff, 1.5);
    spotLight2.position.set(-10, 10, -5);
    spotLight2.angle = Math.PI / 3;
    this.scene.add(spotLight2);

    const spotLight3 = new THREE.SpotLight(0xff4500, 1);
    spotLight3.position.set(10, 10, -5);
    spotLight3.angle = Math.PI / 3;
    this.scene.add(spotLight3);

    const pointLight = new THREE.PointLight(0xffd700, 1, 50);
    pointLight.position.set(0, 5, 0);
    this.scene.add(pointLight);
    this.lights.push(pointLight);
  }

  createStarField() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 200;
      positions[i + 1] = (Math.random() - 0.5) * 200;
      positions[i + 2] = (Math.random() - 0.5) * 100 - 20;

      const color = new THREE.Color();
      color.setHSL(Math.random() * 0.2 + 0.55, 0.8, 0.6 + Math.random() * 0.4);
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);
  }

  createMainStage() {
    const ringGeometry = new THREE.TorusGeometry(5, 0.15, 16, 100);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.questionRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.questionRing.position.set(0, 0, -2);
    this.scene.add(this.questionRing);

    const innerRingGeometry = new THREE.TorusGeometry(4.5, 0.08, 16, 100);
    const innerRingMaterial = new THREE.MeshStandardMaterial({
      color: 0x4040ff,
      emissive: 0x4040ff,
      emissiveIntensity: 0.3,
      metalness: 0.6,
      roughness: 0.3,
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.position.set(0, 0, -2.1);
    this.innerRing = innerRing;
    this.scene.add(innerRing);

    const circleGeometry = new THREE.CircleGeometry(4.2, 64);
    const circleMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a5e,
      emissive: 0x1a1a5e,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.position.set(0, 0, -2.2);
    this.scene.add(circle);

    const diamondShape = new THREE.Shape();
    diamondShape.moveTo(0, 0.3);
    diamondShape.lineTo(0.2, 0);
    diamondShape.lineTo(0, -0.3);
    diamondShape.lineTo(-0.2, 0);
    diamondShape.closePath();

    const diamondGeometry = new THREE.ExtrudeGeometry(diamondShape, { depth: 0.05, bevelEnabled: false });
    const positions = diamondGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setX(i, x * 8);
      positions.setY(i, y * 8);
    }
    diamondGeometry.computeVertexNormals();

    const diamondMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.2,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6,
    });
    const diamond = new THREE.Mesh(diamondGeometry, diamondMaterial);
    diamond.position.set(0, 0, -1.9);
    this.diamond = diamond;
    this.scene.add(diamond);
  }

  createGlowEffects() {
    const sphereGeometry = new THREE.SphereGeometry(6, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4040ff,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    });
    this.glowSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.glowSphere.position.set(0, 0, -3);
    this.scene.add(this.glowSphere);
  }

  createParticles() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 30;
      positions[i + 1] = (Math.random() - 0.5) * 30;
      positions[i + 2] = (Math.random() - 0.5) * 20 - 5;
      velocities.push({
        x: (Math.random() - 0.5) * 0.02,
        y: Math.random() * 0.02 + 0.01,
        z: (Math.random() - 0.5) * 0.01,
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.velocities = velocities;
    this.scene.add(points);
    this.particles.push(points);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = this.clock.getElapsedTime();

    if (this.questionRing) {
      this.questionRing.rotation.z = time * 0.2;
    }
    if (this.innerRing) {
      this.innerRing.rotation.z = -time * 0.3;
    }
    if (this.diamond) {
      this.diamond.rotation.z = Math.sin(time * 0.5) * 0.1;
    }
    if (this.glowSphere) {
      this.glowSphere.scale.setScalar(1 + Math.sin(time) * 0.05);
    }

    if (this.stars) {
      this.stars.rotation.y = time * 0.01;
    }

    this.particles.forEach(p => {
      const positions = p.geometry.attributes.position.array;
      const velocities = p.userData.velocities;
      for (let i = 0; i < velocities.length; i++) {
        positions[i * 3] += velocities[i].x;
        positions[i * 3 + 1] += velocities[i].y;
        positions[i * 3 + 2] += velocities[i].z;

        if (positions[i * 3 + 1] > 15) {
          positions[i * 3 + 1] = -15;
          positions[i * 3] = (Math.random() - 0.5) * 30;
        }
      }
      p.geometry.attributes.position.needsUpdate = true;
    });

    this.lights.forEach(light => {
      if (light.isPointLight) {
        light.intensity = 1 + Math.sin(time * 2) * 0.3;
      }
    });

    this.camera.position.x = Math.sin(time * 0.1) * 0.5;
    this.camera.position.y = 2 + Math.sin(time * 0.15) * 0.3;
    this.camera.lookAt(0, 0, -2);

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupUI() {
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-leaderboard').addEventListener('click', () => this.showLeaderboard());
    document.getElementById('btn-how-to').addEventListener('click', () => this.showHowTo());
    document.getElementById('btn-admin').addEventListener('click', () => window.adminManager.init());
    document.getElementById('btn-admin-back').addEventListener('click', () => this.showScreen('main-menu'));
    document.getElementById('btn-play-again').addEventListener('click', () => this.startGame());
    document.getElementById('btn-back-menu').addEventListener('click', () => this.showScreen('main-menu'));
    document.getElementById('btn-lb-back').addEventListener('click', () => this.showScreen('main-menu'));
    document.getElementById('btn-howto-back').addEventListener('click', () => this.showScreen('main-menu'));
    document.getElementById('btn-quit').addEventListener('click', () => this.walkAway());

    document.querySelectorAll('.answer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!this.isAnswering) this.selectAnswer(e.currentTarget.dataset.answer);
      });
    });

    document.getElementById('lifeline-5050').addEventListener('click', () => this.useLifeline('5050'));
    document.getElementById('lifeline-audience').addEventListener('click', () => this.useLifeline('audience'));
    document.getElementById('lifeline-phone').addEventListener('click', () => this.useLifeline('phone'));

    this.setupAuthUI();
  }

  setupAuthUI() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
      });
    });

    document.querySelectorAll('.avatar-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('login-error');
      errorDiv.textContent = '';
      try {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        await window.authManager.login(username, password);
        this.updateUserBar();
        this.showScreen('main-menu');
      } catch (err) {
        errorDiv.textContent = err.message;
      }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('register-error');
      errorDiv.textContent = '';

      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirm = document.getElementById('reg-password-confirm').value;
      const avatar = document.querySelector('.avatar-option.selected')?.dataset.avatar || '🎮';

      if (password !== confirm) {
        errorDiv.textContent = 'Passwords do not match';
        return;
      }

      try {
        await window.authManager.register(username, email, password, avatar);
        this.updateUserBar();
        this.showScreen('main-menu');
      } catch (err) {
        errorDiv.textContent = err.message;
      }
    });

    document.getElementById('btn-guest').addEventListener('click', () => {
      window.authManager.setGuest();
      this.showScreen('main-menu');
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
      await window.authManager.logout();
      document.getElementById('user-bar').classList.add('hidden');
      this.showScreen('auth-screen');
    });

    document.getElementById('btn-profile').addEventListener('click', () => this.showProfile());
    document.getElementById('btn-profile-back').addEventListener('click', () => this.showScreen('main-menu'));

    document.querySelectorAll('.lb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.loadLeaderboard(tab.dataset.type);
      });
    });
  }

  showScreen(screenId) {
    window.audioManager.playMenuClick();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  async loadCategories() {
    try {
      const res = await fetch('/api/categories');
      const categories = await res.json();
      const dropdown = document.getElementById('category-dropdown');
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        dropdown.appendChild(option);
      });
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  async startGame() {
    this.category = document.getElementById('category-dropdown').value;
    this.currentQuestionIndex = 0;
    this.lifelines = { '5050': true, audience: true, phone: true };
    this.selectedAnswer = null;
    this.isAnswering = false;
    this.newRecord = false;

    if (window.authManager.isLoggedIn()) {
      this.playerName = window.authManager.user.username;
      this.playerAvatar = window.authManager.user.avatar;
    } else {
      this.playerName = 'Guest';
      this.playerAvatar = '🎮';
    }

    document.getElementById('player-name-display').textContent = this.playerName;
    document.getElementById('player-avatar-icon').textContent = this.playerAvatar;
    document.getElementById('player-avatar-icon').style.display = this.playerAvatar ? 'inline' : 'none';
    document.querySelectorAll('.lifeline-btn').forEach(btn => btn.classList.remove('used'));
    document.querySelectorAll('.prize-item').forEach(item => item.classList.remove('active'));

    try {
      const url = `/api/game/start?category=${encodeURIComponent(this.category)}`;
      const res = await fetch(url);
      const data = await res.json();
      this.questions = data.questions;

      if (this.questions.length === 0) {
        alert('No questions found for this category!');
        return;
      }

      this.showScreen('game-screen');
      window.audioManager.startBackgroundMusic();
      this.displayQuestion();
    } catch (err) {
      console.error('Failed to start game:', err);
      alert('Failed to load questions. Is the database running?');
    }
  }

  displayQuestion() {
    const q = this.questions[this.currentQuestionIndex];
    if (!q) return;

    this.selectedAnswer = null;
    this.isAnswering = false;

    document.getElementById('question-text').textContent = q.question;
    document.getElementById('current-q').textContent = this.currentQuestionIndex + 1;
    document.getElementById('total-q').textContent = this.questions.length;
    document.getElementById('current-prize').textContent = this.prizeLevels[this.currentQuestionIndex].toLocaleString();

    const answerBtns = document.querySelectorAll('.answer-btn');
    answerBtns.forEach(btn => {
      btn.classList.remove('selected', 'correct', 'wrong', 'disabled');
      const label = btn.dataset.answer;
      btn.querySelector('.answer-text').textContent = q.options[label];
    });

    document.querySelectorAll('.prize-item').forEach(item => item.classList.remove('active'));
    const prizeItem = document.querySelector(`.prize-item[data-level="${this.currentQuestionIndex + 1}"]`);
    if (prizeItem) prizeItem.classList.add('active');

    document.getElementById('audience-poll').classList.add('hidden');

    this.animateQuestionEntry();
    window.audioManager.playDramatic();
    window.audioManager.stopBackgroundMusic();
    window.audioManager.startTensionMusic();
  }

  animateQuestionEntry() {
    if (this.questionRing) {
      this.questionRing.scale.set(0.5, 0.5, 0.5);
      const startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 500;
        if (elapsed < 1) {
          const scale = 0.5 + elapsed * 0.5;
          this.questionRing.scale.set(scale, scale, scale);
          requestAnimationFrame(animate);
        } else {
          this.questionRing.scale.set(1, 1, 1);
        }
      };
      animate();
    }
  }

  selectAnswer(answer) {
    if (this.isAnswering) return;
    this.isAnswering = true;
    this.selectedAnswer = answer;

    const correctAnswer = this.questions[this.currentQuestionIndex].correct_answer;

    window.audioManager.playSelect();
    document.querySelectorAll('.answer-btn').forEach(btn => {
      if (btn.dataset.answer === answer) {
        btn.classList.add('selected');
      }
    });

    setTimeout(() => {
      window.audioManager.playLockIn();
      let tickCount = 0;
      const tickInterval = setInterval(() => {
        window.audioManager.playTick();
        tickCount++;
        if (tickCount >= 3) clearInterval(tickInterval);
      }, 400);

      document.querySelectorAll('.answer-btn').forEach(btn => {
        if (btn.dataset.answer === answer) {
          if (answer === correctAnswer) {
            btn.classList.add('correct');
          } else {
            btn.classList.add('wrong');
          }
        }
        if (btn.dataset.answer === correctAnswer && answer !== correctAnswer) {
          btn.classList.add('correct');
        }
      });

      setTimeout(() => {
        window.audioManager.stopBackgroundMusic();
        if (answer === correctAnswer) {
          this.correctAnswer();
        } else {
          this.wrongAnswer();
        }
      }, 2000);
    }, 1500);
  }

  correctAnswer() {
    window.audioManager.playCorrect();
    this.currentQuestionIndex++;

    if (this.currentQuestionIndex === 5 || this.currentQuestionIndex === 10) {
      setTimeout(() => window.audioManager.playMilestone(), 500);
    }

    if (window.authManager.isLoggedIn()) {
      const currentPrize = this.prizeLevels[this.currentQuestionIndex - 1];
      if (currentPrize > (window.authManager.user.best_score || 0)) {
        this.newRecord = true;
      }
    }

    if (this.currentQuestionIndex >= this.questions.length) {
      this.gameWon();
      return;
    }

    setTimeout(() => this.displayQuestion(), 1000);
  }

  async wrongAnswer() {
    const prize = this.currentQuestionIndex >= 10 ? this.prizeLevels[9] :
                  this.currentQuestionIndex >= 5 ? this.prizeLevels[4] : 0;

    await this.saveGame('lost', prize, this.currentQuestionIndex);

    window.audioManager.stopBackgroundMusic();
    window.audioManager.playWrong();
    setTimeout(() => window.audioManager.playGameOver(), 1000);

    document.getElementById('result-title').textContent = 'GAME OVER';
    document.getElementById('result-amount').textContent = `You walked away with $${prize.toLocaleString()}`;
    document.getElementById('result-message').textContent = `The correct answer was: ${this.questions[this.currentQuestionIndex]?.correct_answer || ''}`;
    document.getElementById('result-new-record').classList.add('hidden');
    this.showScreen('result-screen');
  }

  async gameWon() {
    const prize = this.prizeLevels[14];
    await this.saveGame('won', prize, 15);

    window.audioManager.stopBackgroundMusic();
    window.audioManager.playWin();
    setTimeout(() => window.audioManager.startVictoryMusic(), 2000);

    document.getElementById('result-title').textContent = 'CONGRATULATIONS!';
    document.getElementById('result-amount').textContent = '$1,000,000';
    document.getElementById('result-message').textContent = 'You are a MILLIONAIRE!';
    if (this.newRecord) {
      document.getElementById('result-new-record').classList.remove('hidden');
    } else {
      document.getElementById('result-new-record').classList.add('hidden');
    }
    this.showScreen('result-screen');
  }

  async walkAway() {
    const prize = this.currentQuestionIndex > 0 ?
      (this.currentQuestionIndex - 1 >= 10 ? this.prizeLevels[9] :
       this.currentQuestionIndex - 1 >= 5 ? this.prizeLevels[4] : 0) : 0;

    await this.saveGame('quit', prize, this.currentQuestionIndex);

    window.audioManager.stopBackgroundMusic();
    window.audioManager.playGameOver();

    document.getElementById('result-title').textContent = 'YOU WALKED AWAY';
    document.getElementById('result-amount').textContent = `$${prize.toLocaleString()}`;
    document.getElementById('result-message').textContent = 'Thanks for playing!';
    document.getElementById('result-new-record').classList.add('hidden');
    this.showScreen('result-screen');
  }

  useLifeline(type) {
    if (!this.lifelines[type]) return;
    this.lifelines[type] = false;

    window.audioManager.playLifeline();

    const btnMap = { '5050': 'lifeline-5050', audience: 'lifeline-audience', phone: 'lifeline-phone' };
    document.getElementById(btnMap[type]).classList.add('used');

    switch (type) {
      case '5050':
        this.use5050();
        break;
      case 'audience':
        this.useAudiencePoll();
        break;
      case 'phone':
        this.usePhoneFriend();
        break;
    }
  }

  use5050() {
    const correct = this.questions[this.currentQuestionIndex].correct_answer;
    const allAnswers = ['A', 'B', 'C', 'D'];
    const wrongAnswers = allAnswers.filter(a => a !== correct);
    const toRemove = wrongAnswers.sort(() => Math.random() - 0.5).slice(0, 2);

    document.querySelectorAll('.answer-btn').forEach(btn => {
      if (toRemove.includes(btn.dataset.answer)) {
        btn.classList.add('disabled');
      }
    });
  }

  useAudiencePoll() {
    const correct = this.questions[this.currentQuestionIndex].correct_answer;
    const allAnswers = ['A', 'B', 'C', 'D'];
    const percentages = {};
    let remaining = 100;

    const correctPct = 40 + Math.floor(Math.random() * 35);
    percentages[correct] = correctPct;
    remaining -= correctPct;

    const wrongAnswers = allAnswers.filter(a => a !== correct);
    wrongAnswers.forEach((ans, i) => {
      if (i === wrongAnswers.length - 1) {
        percentages[ans] = remaining;
      } else {
        const pct = Math.floor(Math.random() * remaining * 0.6);
        percentages[ans] = pct;
        remaining -= pct;
      }
    });

    document.getElementById('audience-poll').classList.remove('hidden');
    allAnswers.forEach(ans => {
      document.getElementById(`poll-${ans.toLowerCase()}`).style.width = '0%';
      document.getElementById(`percent-${ans.toLowerCase()}`).textContent = '0%';
    });

    setTimeout(() => {
      allAnswers.forEach(ans => {
        document.getElementById(`poll-${ans.toLowerCase()}`).style.width = `${percentages[ans]}%`;
        document.getElementById(`percent-${ans.toLowerCase()}`).textContent = `${percentages[ans]}%`;
      });
    }, 100);
  }

  usePhoneFriend() {
    const correct = this.questions[this.currentQuestionIndex].correct_answer;
    const confidence = 60 + Math.floor(Math.random() * 30);
    const suggestion = Math.random() * 100 < confidence ? correct : ['A', 'B', 'C', 'D'].filter(a => a !== correct)[Math.floor(Math.random() * 3)];

    alert(`📞 Your friend says: "I'm about ${confidence}% sure the answer is ${suggestion}. That's my best guess!"`);
  }

  async saveGame(status, score, question) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (window.authManager.token) {
        headers['Authorization'] = `Bearer ${window.authManager.token}`;
      }

      await fetch('/api/game/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({ playerName: this.playerName, score, currentQuestion: question, status, category: this.category }),
      });

      if (window.authManager.isLoggedIn()) {
        await window.authManager.refreshUser();
        this.updateUserBar();
      }
    } catch (err) {
      console.error('Failed to save game:', err);
    }
  }

  showLeaderboard() {
    this.showScreen('leaderboard-screen');
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.lb-tab[data-type="score"]').classList.add('active');
    this.loadLeaderboard('score');
  }

  async loadLeaderboard(type) {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<p>Loading...</p>';

    try {
      const res = await fetch(`/api/leaderboard?type=${type}`);
      const entries = await res.json();

      if (entries.length === 0) {
        list.innerHTML = '<p>No players registered yet. Create an account and be the first!</p>';
        return;
      }

      list.innerHTML = entries.map((e, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        const rank = i < 3 ? medals[i] : `#${i + 1}`;
        return `
          <div class="leaderboard-entry">
            <span class="lb-rank">${rank}</span>
            <span class="lb-avatar">${e.avatar || '🎮'}</span>
            <span class="lb-name">${e.username}</span>
            <span class="lb-stats">
              <span class="lb-score">$${e.best_score?.toLocaleString() || 0}</span>
              <span class="lb-detail">${e.total_wins || 0}W / ${e.total_games || 0}G (${e.win_rate || 0}%)</span>
            </span>
          </div>
        `;
      }).join('');
    } catch (err) {
      list.innerHTML = '<p>Failed to load leaderboard.</p>';
    }
  }

  async showProfile() {
    if (!window.authManager.isLoggedIn()) {
      alert('Please login to view your profile!');
      return;
    }

    this.showScreen('profile-screen');
    const user = window.authManager.user;

    document.getElementById('profile-avatar').textContent = user.avatar;
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('stat-games').textContent = user.total_games;
    document.getElementById('stat-wins').textContent = user.total_wins;
    document.getElementById('stat-winrate').textContent = user.total_games > 0
      ? `${Math.round(user.total_wins / user.total_games * 100)}%` : '0%';
    document.getElementById('stat-best-score').textContent = user.best_score.toLocaleString();
    document.getElementById('stat-best-question').textContent = user.best_question;

    const historyDiv = document.getElementById('profile-history');
    historyDiv.innerHTML = '<p>Loading history...</p>';

    try {
      const headers = window.authManager.token
        ? { 'Authorization': `Bearer ${window.authManager.token}` } : {};
      const res = await fetch('/api/leaderboard/history', { headers });
      const history = await res.json();

      if (history.length === 0) {
        historyDiv.innerHTML = '<p>No games played yet.</p>';
        return;
      }

      historyDiv.innerHTML = history.map(h => {
        const date = new Date(h.started_at).toLocaleDateString();
        const statusIcon = h.status === 'won' ? '🏆' : h.status === 'lost' ? '❌' : '🚪';
        return `
          <div class="history-entry ${h.status}">
            <span class="hist-status">${statusIcon}</span>
            <span class="hist-score">$${h.score.toLocaleString()}</span>
            <span class="hist-question">Q${h.current_question}</span>
            <span class="hist-cat">${h.category_played || 'mixed'}</span>
            <span class="hist-date">${date}</span>
          </div>
        `;
      }).join('');
    } catch (err) {
      historyDiv.innerHTML = '<p>Failed to load history.</p>';
    }
  }

  showHowTo() {
    this.showScreen('howto-screen');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new MillionaireGame();
});
