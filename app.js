/**
 * app.js
 * Controlador Principal de TACTICAL ARENA PWA.
 * Integra Lobby Multijugador (Firebase Realtime DB), Visión Artificial en Cilindro Central,
 * Armería / Taller de Armas (Base64 + Categorías Dinámicas), Física de Casquillos en <canvas>
 * y Síntesis Acústica Web Audio API con retardo de 400ms para caída de casquillo.
 */

import {
  TacticalNetwork,
  DONATION_CONFIG,
  getActiveFirebaseConfig,
  saveFirebaseConfigOverride,
  clearFirebaseConfigOverride
} from './firebase-config.js';
import { ArmoryManager } from './weapons.js';
import { TacticalVisionSystem } from './vision.js';
import { TacticalAudioEngine } from './audio.js';

class TacticalGameApp {
  constructor() {
    this.network = new TacticalNetwork();
    this.armory = new ArmoryManager();
    this.vision = new TacticalVisionSystem();
    this.audio = new TacticalAudioEngine();

    // Estado del Operador y Combate
    this.alias = localStorage.getItem('tactical_operator_alias_v1') || 'GHOST-01';
    this.brigade = localStorage.getItem('tactical_operator_brigade_v1') || 'alpha';
    this.isOfflineMode = false;
    this.inCombat = false;
    this.isEliminated = false;
    this.isReloading = false;
    this.lastShotTimestamp = 0;

    // Estado de la Sala Multijugador
    this.roomState = null;
    this.lastProcessedKillEventId = null;

    // Arma Activa y Munición
    this.currentWeapon = this.armory.getSelectedWeapon();
    this.currentAmmo = this.currentWeapon.magCapacity;

    // Cámara y Partículas de Casquillos en <canvas>
    this.mediaStream = null;
    this.shellCasings = [];
    this.animFrameId = null;
    this.lastCanvasTime = 0;

    // Estado temporal del Taller de Armas
    this.activeArmoryCategory = 'Todas';
    this.uploadedWeaponDataUrl = null;
    this.lastUploadedRawFile = null;

    this._cacheDom();
    this._bindEvents();
    this._initUi();
    this._registerServiceWorker();
  }

  _cacheDom() {
    // Pantallas
    this.lobbyScreen = document.getElementById('lobby-screen');
    this.combatScreen = document.getElementById('combat-screen');

    // Lobby
    this.networkDot = document.getElementById('network-status-dot');
    this.networkModeLabel = document.getElementById('network-mode-label');
    this.btnDonate = document.getElementById('btn-donate');
    this.donateLabel = document.getElementById('donate-label');
    this.aliasInput = document.getElementById('operator-alias');
    this.btnBrigadeAlpha = document.getElementById('btn-brigade-alpha');
    this.btnBrigadeBravo = document.getElementById('btn-brigade-bravo');
    this.alphaCountBadge = document.getElementById('alpha-count-badge');
    this.bravoCountBadge = document.getElementById('bravo-count-badge');
    this.btnCreateRoom = document.getElementById('btn-create-room');
    this.roomCodeInput = document.getElementById('room-code-input');
    this.btnJoinRoom = document.getElementById('btn-join-room');
    this.activeRoomPanel = document.getElementById('active-room-panel');
    this.displayRoomCode = document.getElementById('display-room-code');
    this.btnCopyCode = document.getElementById('btn-copy-code');
    this.rosterAlpha = document.getElementById('roster-alpha');
    this.rosterBravo = document.getElementById('roster-bravo');
    this.lobbyWeaponPreview = document.getElementById('lobby-weapon-preview');
    this.lobbyWeaponCategory = document.getElementById('lobby-weapon-category');
    this.lobbyWeaponName = document.getElementById('lobby-weapon-name');
    this.lobbyWeaponStats = document.getElementById('lobby-weapon-stats');
    this.btnOpenArmoryLobby = document.getElementById('btn-open-armory-lobby');
    this.btnEnterCombat = document.getElementById('btn-enter-combat');
    this.btnOfflineTest = document.getElementById('btn-offline-test');
    this.lobbyFeedback = document.getElementById('lobby-feedback');

    // Combate
    this.videoEl = document.getElementById('camera-video');
    this.dummyOverlay = document.getElementById('dummy-target-overlay');
    this.fxCanvas = document.getElementById('fx-canvas');
    this.fxCtx = this.fxCanvas.getContext('2d');
    this.cylinderGuide = document.getElementById('cylinder-hitbox-guide');
    this.cylinderTelemetryLabel = document.getElementById('cylinder-telemetry-label');
    this.hitmarkerFlash = document.getElementById('hitmarker-flash');
    this.triggerZone = document.getElementById('trigger-zone');
    this.fpWeaponContainer = document.getElementById('fp-weapon-container');
    this.fpWeaponImg = document.getElementById('fp-weapon-img');
    this.muzzleFlash = document.getElementById('muzzle-flash');

    // HUD Combate
    this.btnExitCombat = document.getElementById('btn-exit-combat');
    this.hudRoomBadge = document.getElementById('hud-room-badge');
    this.hudBrigadeBadge = document.getElementById('hud-brigade-badge');
    this.shotValidationBanner = document.getElementById('shot-validation-banner');
    this.hudAiStatus = document.getElementById('hud-ai-status');
    this.hudCompassStatus = document.getElementById('hud-compass-status');
    this.hudGpsStatus = document.getElementById('hud-gps-status');
    this.testModeToolbar = document.getElementById('test-mode-toolbar');
    this.btnToggleDummy = document.getElementById('btn-toggle-dummy');
    this.btnSimulateHitMe = document.getElementById('btn-simulate-hit-me');
    this.hudAmmoCurrent = document.getElementById('hud-ammo-current');
    this.hudAmmoMax = document.getElementById('hud-ammo-max');
    this.hudWeaponName = document.getElementById('hud-weapon-name');
    this.hudWeaponCaliber = document.getElementById('hud-weapon-caliber');
    this.reloadProgressWrap = document.getElementById('reload-progress-wrap');
    this.reloadProgressBar = document.getElementById('reload-progress-bar');
    this.btnReload = document.getElementById('btn-reload');
    this.btnSlideRack = document.getElementById('btn-slide-rack');
    this.btnSurfaceToggle = document.getElementById('btn-surface-toggle');
    this.surfaceLabel = document.getElementById('surface-label');
    this.btnOpenArmoryHud = document.getElementById('btn-open-armory-hud');

    // Eliminación
    this.eliminationOverlay = document.getElementById('elimination-overlay');
    this.eliminatedByName = document.getElementById('eliminated-by-name');
    this.eliminatedWeaponInfo = document.getElementById('eliminated-weapon-info');
    this.btnRespawn = document.getElementById('btn-respawn');

    // Modal Armería y Taller de Armas
    this.armoryModal = document.getElementById('armory-modal');
    this.btnCloseArmory = document.getElementById('btn-close-armory');
    this.tabSelectWeapons = document.getElementById('tab-select-weapons');
    this.tabCreateWeapon = document.getElementById('tab-create-weapon');
    this.armorySelectorView = document.getElementById('armory-selector-view');
    this.categoryTabsBar = document.getElementById('category-tabs-bar');
    this.weaponsGrid = document.getElementById('weapons-grid');
    this.workshopForm = document.getElementById('weapon-workshop-form');
    this.weaponImageInput = document.getElementById('weapon-image-input');
    this.chkRemoveBg = document.getElementById('chk-remove-bg');
    this.workshopImagePreview = document.getElementById('workshop-image-preview');
    this.workshopPreviewPlaceholder = document.getElementById('workshop-preview-placeholder');
    this.workshopCategorySelect = document.getElementById('workshop-category-select');
    this.newCategoryRow = document.getElementById('new-category-row');
    this.workshopNewCategory = document.getElementById('workshop-new-category');
    this.workshopName = document.getElementById('workshop-name');
    this.workshopCaliber = document.getElementById('workshop-caliber');
    this.workshopMag = document.getElementById('workshop-mag');
    this.workshopFirerate = document.getElementById('workshop-firerate');
    this.workshopReload = document.getElementById('workshop-reload');
    this.workshopRange = document.getElementById('workshop-range');
    this.workshopFeedback = document.getElementById('workshop-feedback');

    // Modal Firebase
    this.btnFirebaseSettings = document.getElementById('btn-firebase-settings');
    this.firebaseModal = document.getElementById('firebase-modal');
    this.btnCloseFirebase = document.getElementById('btn-close-firebase');
    this.firebaseConfigForm = document.getElementById('firebase-config-form');
    this.fbApiKey = document.getElementById('fb-api-key');
    this.fbDbUrl = document.getElementById('fb-db-url');
    this.fbProjectId = document.getElementById('fb-project-id');
    this.btnResetFirebase = document.getElementById('btn-reset-firebase');
  }

  _bindEvents() {
    // Alias y Selección de Brigada
    this.aliasInput.addEventListener('input', () => {
      this.alias = (this.aliasInput.value || '').trim().toUpperCase() || 'OPERADOR';
      localStorage.setItem('tactical_operator_alias_v1', this.alias);
      this.network.updatePlayerProfile({ alias: this.alias });
    });

    this.btnBrigadeAlpha.addEventListener('click', () => this._setBrigade('alpha'));
    this.btnBrigadeBravo.addEventListener('click', () => this._setBrigade('bravo'));

    // Crear / Unirse a Sala
    this.btnCreateRoom.addEventListener('click', () => this._handleCreateRoom());
    this.btnJoinRoom.addEventListener('click', () => this._handleJoinRoom());
    this.btnCopyCode.addEventListener('click', () => {
      if (this.network.roomCode && navigator.clipboard) {
        navigator.clipboard.writeText(this.network.roomCode);
        this._showLobbyFeedback(`Código ${this.network.roomCode} copiado al portapapeles.`);
      }
    });

    // Despliegue a Combate / Modo Prueba
    this.btnEnterCombat.addEventListener('click', () => this._startCombat(false));
    this.btnOfflineTest.addEventListener('click', () => this._startCombat(true));
    this.btnExitCombat.addEventListener('click', () => this._exitCombatToLobby());

    // Gatillo en cualquier parte libre de la pantalla
    this.triggerZone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._handleTriggerPull(e.clientX, e.clientY);
    });

    // Controles Tácticos en Combate
    this.btnReload.addEventListener('click', () => this._handleReload());
    this.btnSlideRack.addEventListener('click', () => this._handleManualSlideRack());
    this.btnSurfaceToggle.addEventListener('click', () => this._toggleGroundSurface());

    // Herramientas de Modo Prueba (1 Jugador)
    this.btnToggleDummy.addEventListener('click', () => {
      this.vision.dummyTargetEnabled = !this.vision.dummyTargetEnabled;
      this.dummyOverlay.classList.toggle('hidden', !this.vision.dummyTargetEnabled);
      this.btnToggleDummy.textContent = this.vision.dummyTargetEnabled
        ? '👤 Silueta Prueba: ON'
        : '👤 Silueta Prueba: OFF';
    });

    this.btnSimulateHitMe.addEventListener('click', () => {
      this._triggerEliminationScreen({
        killerAlias: 'FRANCOTIRADOR-BRAVO (SIMULADO)',
        weaponName: 'AWM L115A3 .338',
        distance: 85
      });
    });

    // Reaparecer tras eliminación
    this.btnRespawn.addEventListener('click', () => this._handleRespawn());

    // Armería y Taller de Armas
    this.btnOpenArmoryLobby.addEventListener('click', () => this._openArmoryModal('select'));
    this.btnOpenArmoryHud.addEventListener('click', () => this._openArmoryModal('select'));
    this.btnCloseArmory.addEventListener('click', () => this._closeArmoryModal());

    this.tabSelectWeapons.addEventListener('click', () => this._switchArmoryTab('select'));
    this.tabCreateWeapon.addEventListener('click', () => this._switchArmoryTab('create'));

    this.workshopCategorySelect.addEventListener('change', () => {
      const isNew = this.workshopCategorySelect.value === '__new__';
      this.newCategoryRow.classList.toggle('hidden', !isNew);
      if (isNew) this.workshopNewCategory.focus();
    });

    this.weaponImageInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        this.lastUploadedRawFile = file;
        this._processWorkshopImage(file);
      }
    });

    this.chkRemoveBg.addEventListener('change', () => {
      if (this.lastUploadedRawFile) {
        this._processWorkshopImage(this.lastUploadedRawFile);
      }
    });

    this.workshopForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleCreateCustomWeapon();
    });

    // Configuración Firebase Modal
    this.btnFirebaseSettings.addEventListener('click', () => {
      const cfg = getActiveFirebaseConfig();
      this.fbApiKey.value = cfg.apiKey !== 'TU_API_KEY_AQUI' ? cfg.apiKey : '';
      this.fbDbUrl.value = !cfg.databaseURL.includes('tu-proyecto-tactico') ? cfg.databaseURL : '';
      this.fbProjectId.value = cfg.projectId !== 'tu-proyecto-tactico' ? cfg.projectId : '';
      this.firebaseModal.classList.remove('hidden');
    });

    this.btnCloseFirebase.addEventListener('click', () => {
      this.firebaseModal.classList.add('hidden');
    });

    this.firebaseConfigForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const dbUrl = this.fbDbUrl.value.trim();
      if (!dbUrl) return;
      saveFirebaseConfigOverride({
        apiKey: this.fbApiKey.value.trim() || 'AIzaSyDummyKey',
        databaseURL: dbUrl,
        projectId: this.fbProjectId.value.trim() || 'tactical-lasertag'
      });
      window.location.reload();
    });

    this.btnResetFirebase.addEventListener('click', () => {
      clearFirebaseConfigOverride();
      window.location.reload();
    });

    window.addEventListener('resize', () => this._resizeFxCanvas());
  }

  _initUi() {
    this.aliasInput.value = this.alias;
    this._setBrigade(this.brigade, false);

    // Configurar enlace de donación
    if (this.btnDonate && DONATION_CONFIG) {
      this.btnDonate.href = DONATION_CONFIG.url;
      this.donateLabel.textContent = DONATION_CONFIG.label;
    }

    // Mostrar estado de conexión Firebase vs Local
    const mode = this.network.getConnectionMode();
    if (mode === 'firebase') {
      this.networkModeLabel.textContent = 'FIREBASE REALTIME DB // MULTIJUGADOR EN VIVO';
      this.networkDot.style.background = '#00ff88';
    } else {
      this.networkModeLabel.textContent = 'MODO LOCAL / MULTI-PESTAÑA (CONFIGURA ⚙️ DB PARA NUBE)';
      this.networkDot.style.background = '#38bdf8';
    }

    this._updateSurfaceButtonUi();
    this._syncEquippedWeaponUi();
    this._resizeFxCanvas();
  }

  _setBrigade(brigade, notifyNetwork = true) {
    this.brigade = brigade === 'bravo' ? 'bravo' : 'alpha';
    localStorage.setItem('tactical_operator_brigade_v1', this.brigade);

    this.btnBrigadeAlpha.classList.toggle('active', this.brigade === 'alpha');
    this.btnBrigadeBravo.classList.toggle('active', this.brigade === 'bravo');

    this.hudBrigadeBadge.textContent = this.brigade.toUpperCase();
    this.hudBrigadeBadge.className = `hud-brigade ${this.brigade}`;

    if (notifyNetwork) {
      this.network.updatePlayerProfile({ brigade: this.brigade });
    }
  }

  async _handleCreateRoom() {
    this.audio.init();
    try {
      const code = await this.network.createRoom({
        alias: this.alias,
        brigade: this.brigade,
        weaponId: this.currentWeapon.id,
        weaponName: this.currentWeapon.name
      });
      this.roomCodeInput.value = code;
      this._connectRoomSubscription(code);
      this._showLobbyFeedback(`Sala táctica ${code} creada. Comparte el código con tu escuadrón.`);
    } catch (err) {
      this._showLobbyFeedback(`Error creando sala: ${err.message}`, true);
    }
  }

  async _handleJoinRoom() {
    this.audio.init();
    const code = (this.roomCodeInput.value || '').trim().toUpperCase();
    if (code.length !== 4) {
      this._showLobbyFeedback('Ingresa un código válido de 4 letras (ej. TACT).', true);
      return;
    }
    try {
      const joinedCode = await this.network.joinRoom({
        code,
        alias: this.alias,
        brigade: this.brigade,
        weaponId: this.currentWeapon.id,
        weaponName: this.currentWeapon.name
      });
      this._connectRoomSubscription(joinedCode);
      this._showLobbyFeedback(`Conectado a la sala ${joinedCode} en Brigada ${this.brigade.toUpperCase()}.`);
    } catch (err) {
      this._showLobbyFeedback(`Error al unirse: ${err.message}`, true);
    }
  }

  _connectRoomSubscription(code) {
    this.activeRoomPanel.classList.remove('hidden');
    this.displayRoomCode.textContent = code;

    this.network.subscribeToRoom(code, (roomData) => {
      this.roomState = roomData;
      this._renderLobbyRosters(roomData.players || {});
      this._checkIncomingElimination(roomData);
    });
  }

  _renderLobbyRosters(playersMap) {
    const players = Object.values(playersMap);
    const alphaList = players.filter((p) => p.brigade === 'alpha');
    const bravoList = players.filter((p) => p.brigade === 'bravo');

    this.alphaCountBadge.textContent = `${alphaList.length} Operador${alphaList.length === 1 ? '' : 'es'}`;
    this.bravoCountBadge.textContent = `${bravoList.length} Operador${bravoList.length === 1 ? '' : 'es'}`;

    const renderItems = (list) => {
      if (list.length === 0) {
        return '<li class="roster-empty">Sin operadores</li>';
      }
      return list
        .map((p) => {
          const isMe = p.id === this.network.playerId ? ' (TÚ)' : '';
          const statusIcon = p.alive === false ? '☠️' : '🟢';
          const deadClass = p.alive === false ? 'dead' : '';
          return `<li class="roster-item ${deadClass}">
            <span>${statusIcon} ${this._escapeHtml(p.alias)}${isMe}</span>
            <small>${this._escapeHtml(p.weaponName || '')}</small>
          </li>`;
        })
        .join('');
    };

    this.rosterAlpha.innerHTML = renderItems(alphaList);
    this.rosterBravo.innerHTML = renderItems(bravoList);
  }

  _checkIncomingElimination(roomData) {
    if (!roomData || !this.inCombat) return;

    const myPlayer = roomData.players && roomData.players[this.network.playerId];
    const killEv = roomData.lastKillEvent;

    if (
      killEv &&
      killEv.victimId === this.network.playerId &&
      killEv.eventId !== this.lastProcessedKillEventId
    ) {
      this.lastProcessedKillEventId = killEv.eventId;
      this._triggerEliminationScreen({
        killerAlias: `${killEv.killerAlias} (BRIGADA ${(killEv.killerBrigade || '').toUpperCase()})`,
        weaponName: killEv.weaponName || 'Arma Táctica',
        distance: killEv.distance || 15
      });
      return;
    }

    if (myPlayer && myPlayer.alive === false && !this.isEliminated) {
      this._triggerEliminationScreen({
        killerAlias: killEv ? killEv.killerAlias : 'OPERADOR ENEMIGO',
        weaponName: killEv ? killEv.weaponName : 'Impacto Directo',
        distance: killEv ? killEv.distance : 20
      });
    }
  }

  /**
   * Inicia la vista de combate en tiempo real (Sala Multijugador o Modo Prueba 1 Jugador)
   */
  async _startCombat(offlineMode = false) {
    this.audio.init();
    this.isOfflineMode = offlineMode;

    if (!offlineMode && !this.network.roomCode) {
      // Si el jugador toca "Iniciar Combate en Sala" sin haber creado una, creamos una automáticamente
      await this._handleCreateRoom();
    }

    this.inCombat = true;
    this.isEliminated = false;
    this.eliminationOverlay.classList.add('hidden');

    this.lobbyScreen.classList.remove('active');
    this.combatScreen.classList.add('active');

    this.hudRoomBadge.textContent = offlineMode
      ? 'MODO PRUEBA (1P)'
      : `SALA: ${this.network.roomCode}`;
    this.testModeToolbar.classList.toggle('hidden', !offlineMode);

    this._resizeFxCanvas();
    this._startCanvasLoop();

    // Iniciar cámara trasera del smartphone
    await this._startRearCamera();

    // Cargar modelo IA COCO-SSD de forma asíncrona (solo inferirá cuando se toque la pantalla para disparar)
    this.vision.loadAiModel((statusText) => {
      this.hudAiStatus.textContent = statusText;
    });

    // Iniciar sensores GPS + Brújula
    this.vision.startSensors((telemetry) => {
      this.hudCompassStatus.textContent = `🧭 ${telemetry.heading || 0}°`;
      this.hudGpsStatus.textContent = telemetry.hasGps
        ? `📍 GPS ±${Math.round(telemetry.accuracy || 5)}m`
        : '📍 INTERIOR';

      if (!this.isOfflineMode && this.network.roomCode) {
        this.network.updateTelemetry({
          lat: telemetry.lat,
          lng: telemetry.lng,
          heading: telemetry.heading
        });
      }
    });
  }

  async _startRearCamera() {
    try {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      }
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 }
        }
      };
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoEl.srcObject = this.mediaStream;
      await this.videoEl.play();
    } catch (err) {
      console.warn('[Camera] Aviso al abrir cámara trasera (usando modo táctico sin cámara):', err);
      this._setShotBanner('SIN CÁMARA DETECTADA // USA SILUETA DE PRUEBA (1P)', 'blocked');
    }
  }

  _exitCombatToLobby() {
    this.inCombat = false;
    this.vision.stopSensors();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.eliminationOverlay.classList.add('hidden');
    this.combatScreen.classList.remove('active');
    this.lobbyScreen.classList.add('active');
  }

  /**
   * LÓGICA DE DISPARO, VALIDACIÓN CERO-WALLBANG EN CILINDRO CENTRAL Y FÍSICA DE CASQUILLOS
   */
  async _handleTriggerPull() {
    if (!this.inCombat || this.isEliminated || this.isReloading) return;

    const now = performance.now();
    if (now - this.lastShotTimestamp < this.currentWeapon.fireRateMs) {
      return; // Respetar cadencia de disparo del arma
    }

    if (this.currentAmmo <= 0) {
      this.audio.playDryFire();
      this._setShotBanner('¡CARGADOR VACÍO! TOCA RECARGAR', 'blocked');
      return;
    }

    this.lastShotTimestamp = now;
    this.currentAmmo--;
    this._updateAmmoHud();

    // 1. Audio del disparo sin latencia + sonido de casquillo rebotando 400ms después
    this.audio.playGunshot(this.currentWeapon);

    // 2. Animación en primera persona (Retroceso + Fogonazo)
    this._triggerFirstPersonRecoil();

    // 3. Expulsar casquillo girando con gravedad y parábola en <canvas>
    this._spawnShellCasingParticle();

    // 4. Analizar micro-fotograma 640x480 ÚNICAMENTE dentro del cilindro largo central
    const visionResult = await this.vision.analyzeShotOnTrigger(this.videoEl);

    if (!visionResult.targetDetected) {
      // Disparo bloqueado por pared o sin silueta encuadrada en el cilindro central
      this._flashCylinderState('miss');
      this._setShotBanner(`FALLO: ${visionResult.reason.toUpperCase()}`, 'blocked');
      this.cylinderTelemetryLabel.textContent = `CERO WALLBANG // ${visionResult.method}`;
      return;
    }

    // 5. Silueta confirmada dentro del cilindro central
    if (this.isOfflineMode) {
      this.audio.playHitConfirmation();
      this._flashCylinderState('hit');
      this._setShotBanner(
        `🎯 IMPACTO EN CILINDRO (${Math.round(visionResult.confidence * 100)}% • ${visionResult.method})`,
        'hit'
      );
      this.cylinderTelemetryLabel.textContent = `OBJETIVO VALIDADO // ALCANCE ${this.currentWeapon.maxRangeMeters}M`;
      return;
    }

    // 6. En modo Multijugador: confirmar GPS + Brújula + Alcance del arma contra la brigada enemiga
    const roomPlayers = this.roomState ? this.roomState.players : null;
    const hitMatch = this.vision.findHitEnemyPlayer({
      myId: this.network.playerId,
      myBrigade: this.brigade,
      weaponMaxRange: this.currentWeapon.maxRangeMeters,
      roomPlayers
    });

    if (hitMatch && hitMatch.enemy) {
      this.audio.playHitConfirmation();
      this._flashCylinderState('hit');
      this._setShotBanner(
        `☠️ ELIMINADO: ${hitMatch.enemy.alias} (${Math.round(hitMatch.distance)}m)`,
        'hit'
      );

      await this.network.sendEliminationOrder({
        victimId: hitMatch.enemy.id,
        victimAlias: hitMatch.enemy.alias,
        killerAlias: this.alias,
        killerBrigade: this.brigade,
        weaponName: this.currentWeapon.name,
        distance: hitMatch.distance
      });
    } else {
      this._flashCylinderState('hit');
      this._setShotBanner(
        'SILUETA DETECTADA // NINGÚN ENEMIGO EN RANGO/ÁNGULO',
        'blocked'
      );
    }
  }

  _triggerFirstPersonRecoil() {
    this.fpWeaponContainer.classList.remove('recoil-active');
    void this.fpWeaponContainer.offsetWidth;
    this.fpWeaponContainer.classList.add('recoil-active');
    this.muzzleFlash.classList.remove('hidden');

    setTimeout(() => {
      this.muzzleFlash.classList.add('hidden');
      this.fpWeaponContainer.classList.remove('recoil-active');
    }, 85);
  }

  _flashCylinderState(type) {
    this.cylinderGuide.classList.remove('shot-hit', 'shot-miss');
    if (type === 'hit') {
      this.cylinderGuide.classList.add('shot-hit');
      this.hitmarkerFlash.classList.remove('hidden');
    } else {
      this.cylinderGuide.classList.add('shot-miss');
    }

    setTimeout(() => {
      this.cylinderGuide.classList.remove('shot-hit', 'shot-miss');
      this.hitmarkerFlash.classList.add('hidden');
    }, 220);
  }

  _setShotBanner(text, mode = 'normal') {
    this.shotValidationBanner.textContent = text;
    this.shotValidationBanner.className = 'shot-validation-banner';
    if (mode === 'hit') this.shotValidationBanner.classList.add('hit');
    if (mode === 'blocked') this.shotValidationBanner.classList.add('blocked');
  }

  /**
   * Controles Tácticos: Recarga con barra de progreso y sonido mecánico
   */
  _handleReload() {
    if (this.isReloading || this.isEliminated) return;
    if (this.currentAmmo >= this.currentWeapon.magCapacity) {
      this._setShotBanner('CARGADOR COMPLETO', 'normal');
      return;
    }

    this.isReloading = true;
    const duration = this.currentWeapon.reloadTimeMs;
    this.audio.playReloadSound(duration);

    this.reloadProgressWrap.classList.remove('hidden');
    this.reloadProgressBar.style.width = '0%';

    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      this.reloadProgressBar.style.width = `${pct}%`;

      if (elapsed < duration) {
        requestAnimationFrame(step);
      } else {
        this.currentAmmo = this.currentWeapon.magCapacity;
        this.isReloading = false;
        this.reloadProgressWrap.classList.add('hidden');
        this._updateAmmoHud();
        this._setShotBanner('ARMA RECARGADA Y LISTA', 'normal');
      }
    };
    requestAnimationFrame(step);
  }

  /**
   * Controles Tácticos: Extraer Casquillo / Accionar Corredera manualmente
   */
  _handleManualSlideRack() {
    if (this.isReloading || this.isEliminated) return;

    this.audio.playSlideRack();
    this.fpWeaponContainer.classList.remove('rack-active');
    void this.fpWeaponContainer.offsetWidth;
    this.fpWeaponContainer.classList.add('rack-active');
    setTimeout(() => this.fpWeaponContainer.classList.remove('rack-active'), 160);

    // Expulsa un casquillo girando hacia el costado
    this._spawnShellCasingParticle();

    if (this.currentAmmo > 0) {
      this.currentAmmo--;
      this._updateAmmoHud();
    }
    this._setShotBanner('CORREDERA ACCIONADA // CASQUILLO EXTRAÍDO (+400ms AUDIO)', 'normal');
  }

  /**
   * Cambia entre Cemento/Piso duro y Tierra/Pasto para el sonido del casquillo a los 400ms
   */
  _toggleGroundSurface() {
    const next = this.audio.getSurface() === 'concrete' ? 'dirt' : 'concrete';
    this.audio.setSurface(next);
    this._updateSurfaceButtonUi();
    // Reproducir muestra del rebote en la superficie elegida
    this.audio.scheduleShellCasingBounce(80);
  }

  _updateSurfaceButtonUi() {
    const isConcrete = this.audio.getSurface() === 'concrete';
    this.surfaceLabel.textContent = isConcrete ? 'SUELO: CEMENTO' : 'SUELO: TIERRA/PASTO';
  }

  /**
   * PANTALLA DE ELIMINACIÓN: Vibración [400, 100, 400] + Pitido Agudo Web Audio + Bloqueo
   */
  _triggerEliminationScreen({ killerAlias, weaponName, distance }) {
    this.isEliminated = true;

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([400, 100, 400]);
      } catch {}
    }

    this.audio.playEliminationAlert();

    this.eliminatedByName.textContent = killerAlias || 'OPERADOR ENEMIGO';
    this.eliminatedWeaponInfo.textContent = `Arma: ${weaponName || 'Fusil Táctico'} • Distancia: ${Math.round(distance || 15)}m`;
    this.eliminationOverlay.classList.remove('hidden');
  }

  async _handleRespawn() {
    this.isEliminated = false;
    this.currentAmmo = this.currentWeapon.magCapacity;
    this._updateAmmoHud();
    this.eliminationOverlay.classList.add('hidden');
    this._setShotBanner('OPERADOR REDESPLEGADO EN COMBATE', 'normal');

    if (!this.isOfflineMode) {
      await this.network.respawnSelf();
    }
  }

  /**
   * FÍSICA DE CASQUILLOS EN <canvas>: Gravedad, Parábola y Rotación Metálica
   */
  _resizeFxCanvas() {
    if (!this.fxCanvas) return;
    this.fxCanvas.width = window.innerWidth;
    this.fxCanvas.height = window.innerHeight;
  }

  _spawnShellCasingParticle() {
    const w = this.fxCanvas.width || window.innerWidth;
    const h = this.fxCanvas.height || window.innerHeight;

    // Punto de expulsión desde la ventana de eyección del arma en primera persona
    const startX = w * 0.72;
    const startY = h * 0.70;

    this.shellCasings.push({
      x: startX,
      y: startY,
      vx: 165 + Math.random() * 140,       // Velocidad lateral hacia la derecha
      vy: -(420 + Math.random() * 160),    // Impulso parabólico inicial hacia arriba
      angle: Math.random() * Math.PI,
      angularVel: (14 + Math.random() * 12) * (Math.random() > 0.2 ? 1 : -1),
      length: 22,
      thickness: 7,
      alpha: 1.0,
      createdAt: performance.now()
    });
  }

  _startCanvasLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.lastCanvasTime = performance.now();

    const render = (now) => {
      if (!this.inCombat) return;
      const dt = Math.min(0.05, (now - this.lastCanvasTime) / 1000);
      this.lastCanvasTime = now;

      this._updateAndDrawCasings(dt);
      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  _updateAndDrawCasings(dt) {
    const ctx = this.fxCtx;
    const width = this.fxCanvas.width;
    const height = this.fxCanvas.height;
    ctx.clearRect(0, 0, width, height);

    const gravity = 1280; // px/s^2

    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const c = this.shellCasings[i];
      c.vy += gravity * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.angle += c.angularVel * dt;

      if (c.y > height + 50 || c.x > width + 60) {
        this.shellCasings.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      // Cuerpo de latón brillante con gradiente metálico
      const grad = ctx.createLinearGradient(-c.length / 2, -c.thickness / 2, c.length / 2, c.thickness / 2);
      grad.addColorStop(0, '#b45309');
      grad.addColorStop(0.45, '#fde047');
      grad.addColorStop(0.75, '#f59e0b');
      grad.addColorStop(1, '#78350f');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(-c.length / 2, -c.thickness / 2, c.length, c.thickness, 2);
      ctx.fill();
      ctx.stroke();

      // Culote del casquillo
      ctx.fillStyle = '#713f12';
      ctx.fillRect(-c.length / 2, -c.thickness / 2, 3, c.thickness);

      ctx.restore();
    }
  }

  /**
   * ARMERÍA Y TALLER DE ARMAS (SUBIR IMAGEN Y CREAR NUEVAS CATEGORÍAS)
   */
  _syncEquippedWeaponUi() {
    this.currentWeapon = this.armory.getSelectedWeapon();
    this.currentAmmo = this.currentWeapon.magCapacity;

    // Lobby preview
    this.lobbyWeaponPreview.src = this.currentWeapon.imageDataUrl;
    this.lobbyWeaponCategory.textContent = this.currentWeapon.category;
    this.lobbyWeaponName.textContent = this.currentWeapon.name;
    this.lobbyWeaponStats.textContent = `${this.currentWeapon.caliber} • ${this.currentWeapon.magCapacity} balas • Alcance ${this.currentWeapon.maxRangeMeters}m`;

    // Combat HUD preview
    this.fpWeaponImg.src = this.currentWeapon.imageDataUrl;
    this.hudWeaponName.textContent = this.currentWeapon.name;
    this.hudWeaponCaliber.textContent = `${this.currentWeapon.caliber} • Máx ${this.currentWeapon.maxRangeMeters}m`;
    this._updateAmmoHud();

    this.network.updatePlayerProfile({
      weaponId: this.currentWeapon.id,
      weaponName: this.currentWeapon.name
    });
  }

  _updateAmmoHud() {
    this.hudAmmoCurrent.textContent = this.currentAmmo;
    this.hudAmmoMax.textContent = this.currentWeapon.magCapacity;
  }

  _openArmoryModal(initialTab = 'select') {
    this._renderCategoryTabs();
    this._renderWeaponsGrid();
    this._populateWorkshopCategorySelect();
    this._switchArmoryTab(initialTab);
    this.armoryModal.classList.remove('hidden');
  }

  _closeArmoryModal() {
    this.armoryModal.classList.add('hidden');
  }

  _switchArmoryTab(tab) {
    const isSelect = tab === 'select';
    this.tabSelectWeapons.classList.toggle('active', isSelect);
    this.tabCreateWeapon.classList.toggle('active', !isSelect);
    this.armorySelectorView.classList.toggle('hidden', !isSelect);
    this.workshopForm.classList.toggle('hidden', isSelect);
  }

  _renderCategoryTabs() {
    const categories = ['Todas', ...this.armory.getCategories()];
    this.categoryTabsBar.innerHTML = categories
      .map((cat) => {
        const active = cat === this.activeArmoryCategory ? 'active' : '';
        return `<button type="button" class="cat-tab-btn ${active}" data-cat="${this._escapeHtml(cat)}">
          ${this._escapeHtml(cat)}
        </button>`;
      })
      .join('');

    this.categoryTabsBar.querySelectorAll('.cat-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeArmoryCategory = btn.getAttribute('data-cat');
        this._renderCategoryTabs();
        this._renderWeaponsGrid();
      });
    });
  }

  _renderWeaponsGrid() {
    const list = this.armory.getWeaponsByCategory(this.activeArmoryCategory);
    const selectedId = this.armory.getSelectedWeapon().id;

    this.weaponsGrid.innerHTML = list
      .map((w) => {
        const isSelected = w.id === selectedId;
        return `
          <div class="weapon-card ${isSelected ? 'selected' : ''}">
            <div class="weapon-card-img-wrap">
              <img src="${w.imageDataUrl}" alt="${this._escapeHtml(w.name)}" class="weapon-card-img" />
            </div>
            <span class="weapon-cat-pill">${this._escapeHtml(w.category)}</span>
            <div class="weapon-card-title">${this._escapeHtml(w.name)}</div>
            <div class="weapon-stats-list">
              <span>Cal: ${this._escapeHtml(w.caliber)}</span>
              <span>Cargador: ${w.magCapacity}</span>
              <span>Cadencia: ${w.fireRateMs}ms</span>
              <span>Recarga: ${w.reloadTimeMs}ms</span>
              <span>Alcance: ${w.maxRangeMeters}m</span>
            </div>
            <div class="weapon-card-actions">
              <button type="button" class="btn-tactical ${isSelected ? 'secondary' : 'primary'} full-width btn-equip" data-id="${w.id}">
                ${isSelected ? '✓ EQUIPADA' : 'EQUIPAR ARMA'}
              </button>
              ${
                w.isCustom
                  ? `<button type="button" class="btn-tactical secondary btn-delete-weapon" data-id="${w.id}" title="Eliminar arma">🗑️</button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');

    this.weaponsGrid.querySelectorAll('.btn-equip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.armory.selectWeapon(id);
        this._syncEquippedWeaponUi();
        this._renderWeaponsGrid();
        this._closeArmoryModal();
      });
    });

    this.weaponsGrid.querySelectorAll('.btn-delete-weapon').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.armory.deleteCustomWeapon(id);
        this._syncEquippedWeaponUi();
        this._renderWeaponsGrid();
      });
    });
  }

  _populateWorkshopCategorySelect() {
    const cats = this.armory.getCategories();
    this.workshopCategorySelect.innerHTML =
      cats.map((c) => `<option value="${this._escapeHtml(c)}">${this._escapeHtml(c)}</option>`).join('') +
      `<option value="__new__">+ Crear nueva categoría...</option>`;
    this.newCategoryRow.classList.add('hidden');
  }

  async _processWorkshopImage(file) {
    try {
      this.workshopFeedback.textContent = 'Procesando imagen del arma...';
      const dataUrl = await ArmoryManager.processUploadedWeaponImage(file, this.chkRemoveBg.checked);
      this.uploadedWeaponDataUrl = dataUrl;
      this.workshopImagePreview.src = dataUrl;
      this.workshopImagePreview.classList.remove('hidden');
      this.workshopPreviewPlaceholder.classList.add('hidden');
      this.workshopFeedback.textContent = '✓ Imagen lista en Base64 para guardar en localStorage.';
    } catch (err) {
      this.workshopFeedback.textContent = `Error: ${err.message}`;
    }
  }

  _handleCreateCustomWeapon() {
    try {
      const created = this.armory.createCustomWeapon({
        name: this.workshopName.value,
        category: this.workshopCategorySelect.value,
        newCategoryName: this.workshopNewCategory.value,
        caliber: this.workshopCaliber.value,
        magCapacity: this.workshopMag.value,
        fireRateMs: this.workshopFirerate.value,
        reloadTimeMs: this.workshopReload.value,
        maxRangeMeters: this.workshopRange.value,
        imageDataUrl: this.uploadedWeaponDataUrl
      });

      // Limpiar formulario y seleccionar la nueva categoría/arma
      this.workshopName.value = '';
      this.workshopNewCategory.value = '';
      this.uploadedWeaponDataUrl = null;
      this.lastUploadedRawFile = null;
      this.workshopImagePreview.classList.add('hidden');
      this.workshopPreviewPlaceholder.classList.remove('hidden');

      this.activeArmoryCategory = created.category;
      this._syncEquippedWeaponUi();
      this._renderCategoryTabs();
      this._renderWeaponsGrid();
      this._populateWorkshopCategorySelect();
      this._switchArmoryTab('select');
    } catch (err) {
      this.workshopFeedback.textContent = err.message;
    }
  }

  _showLobbyFeedback(msg, isError = false) {
    this.lobbyFeedback.textContent = msg;
    this.lobbyFeedback.style.color = isError ? '#ff2a4b' : '#00ff88';
  }

  _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.tacticalApp = new TacticalGameApp();
});
