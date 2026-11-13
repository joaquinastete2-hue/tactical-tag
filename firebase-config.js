/**
 * firebase-config.js
 * Arquitectura Multijugador de Baja Latencia con Firebase Realtime Database (Plan Gratuito Spark)
 * + Respaldo Local (BroadcastChannel / LocalStorage) para pruebas inmediatas sin servidor.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  onDisconnect,
  remove
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// ============================================================================
// CONFIGURACIÓN DE FIREBASE REALTIME DATABASE (REEMPLAZA CON TUS CREDENCIALES)
// ============================================================================
export const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "tu-proyecto-tactico.firebaseapp.com",
  databaseURL: "https://tu-proyecto-tactico-default-rtdb.firebaseio.com",
  projectId: "tu-proyecto-tactico",
  storageBucket: "tu-proyecto-tactico.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

// Enlace configurable para el botón "Apoyar / Donar" en la esquina del Lobby
export const DONATION_CONFIG = {
  url: "https://ko-fi.com/tu_usuario",
  label: "Apoyar / Donar"
};

const STORAGE_OVERRIDE_KEY = 'tactical_firebase_config_override_v1';
const LOCAL_ROOMS_KEY = 'tactical_local_rooms_v1';

/**
 * Comprueba si el objeto de configuración de Firebase tiene credenciales reales.
 */
export function isFirebaseConfigured(config) {
  if (!config || !config.databaseURL) return false;
  const isPlaceholder =
    config.apiKey === 'TU_API_KEY_AQUI' ||
    config.databaseURL.includes('tu-proyecto-tactico');
  return !isPlaceholder && config.databaseURL.startsWith('https://');
}

/**
 * Obtiene la configuración activa (prioriza la guardada desde el panel de ajustes de la app
 * o usa FIREBASE_CONFIG por defecto).
 */
export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_OVERRIDE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.databaseURL) return parsed;
    }
  } catch (err) {
    console.warn('Error leyendo override de Firebase:', err);
  }
  return FIREBASE_CONFIG;
}

export function saveFirebaseConfigOverride(customConfig) {
  localStorage.setItem(STORAGE_OVERRIDE_KEY, JSON.stringify(customConfig));
}

export function clearFirebaseConfigOverride() {
  localStorage.removeItem(STORAGE_OVERRIDE_KEY);
}

/**
 * Genera un código táctico corto de 4 letras (ej. TACT, ALFA, WOLF)
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Gestor unificado de Red Multijugador (Firebase Realtime Database + Fallback Local)
 */
export class TacticalNetwork {
  constructor() {
    this.db = null;
    this.mode = 'local'; // 'firebase' | 'local'
    this.playerId = this._getOrCreatePlayerId();
    this.roomCode = null;
    this.unsubscribeRoom = null;
    this.broadcastChannel = null;
    this.roomCallback = null;

    this._initBackend();
  }

  _getOrCreatePlayerId() {
    let id = sessionStorage.getItem('tactical_player_id');
    if (!id) {
      id = 'op_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      sessionStorage.setItem('tactical_player_id', id);
    }
    return id;
  }

  _initBackend() {
    const cfg = getActiveFirebaseConfig();
    if (isFirebaseConfigured(cfg)) {
      try {
        const app = initializeApp(cfg, 'tactical-lasertag-' + Date.now());
        this.db = getDatabase(app);
        this.mode = 'firebase';
        console.info('[TacticalNetwork] Conectado a Firebase Realtime Database:', cfg.databaseURL);
        return;
      } catch (err) {
        console.error('[TacticalNetwork] Error inicializando Firebase, activando modo local:', err);
      }
    }

    this.mode = 'local';
    if ('BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('tactical_lasertag_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.roomCode === this.roomCode && this.roomCallback) {
          this._emitLocalRoomState(this.roomCode);
        }
      };
    }
    window.addEventListener('storage', (e) => {
      if (e.key === LOCAL_ROOMS_KEY && this.roomCode && this.roomCallback) {
        this._emitLocalRoomState(this.roomCode);
      }
    });
  }

  getConnectionMode() {
    return this.mode;
  }

  /**
   * Crea una nueva sala de combate con código de 4 letras
   */
  async createRoom({ alias, brigade, weaponId, weaponName }) {
    const code = generateRoomCode();
    const now = Date.now();
    const playerPayload = {
      id: this.playerId,
      alias: alias || 'OPERADOR-01',
      brigade: brigade || 'alpha',
      weaponId: weaponId || 'm4a1_sopmod',
      weaponName: weaponName || 'M4A1 SOPMOD',
      alive: true,
      kills: 0,
      deaths: 0,
      lat: null,
      lng: null,
      heading: 0,
      lastSeen: now
    };

    const roomData = {
      code,
      createdAt: now,
      hostId: this.playerId,
      status: 'active',
      players: {
        [this.playerId]: playerPayload
      },
      lastKillEvent: null
    };

    if (this.mode === 'firebase' && this.db) {
      const roomRef = ref(this.db, `rooms/${code}`);
      await set(roomRef, roomData);
      const playerRef = ref(this.db, `rooms/${code}/players/${this.playerId}`);
      onDisconnect(playerRef).remove();
    } else {
      const rooms = this._getLocalRooms();
      rooms[code] = roomData;
      this._saveLocalRooms(rooms);
    }

    this.roomCode = code;
    return code;
  }

  /**
   * Se une a una sala existente mediante el código de 4 letras
   */
  async joinRoom({ code, alias, brigade, weaponId, weaponName }) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (cleanCode.length !== 4) {
      throw new Error('El código de sala debe tener 4 caracteres (ej. TACT).');
    }

    const now = Date.now();
    const playerPayload = {
      id: this.playerId,
      alias: alias || 'OPERADOR',
      brigade: brigade || 'alpha',
      weaponId: weaponId || 'm4a1_sopmod',
      weaponName: weaponName || 'M4A1 SOPMOD',
      alive: true,
      kills: 0,
      deaths: 0,
      lat: null,
      lng: null,
      heading: 0,
      lastSeen: now
    };

    if (this.mode === 'firebase' && this.db) {
      const roomRef = ref(this.db, `rooms/${cleanCode}`);
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        // Si la sala no existe aún, la inicializamos automáticamente con ese código
        await set(roomRef, {
          code: cleanCode,
          createdAt: now,
          hostId: this.playerId,
          status: 'active',
          players: { [this.playerId]: playerPayload },
          lastKillEvent: null
        });
      } else {
        const playerRef = ref(this.db, `rooms/${cleanCode}/players/${this.playerId}`);
        await set(playerRef, playerPayload);
      }
      const playerRef = ref(this.db, `rooms/${cleanCode}/players/${this.playerId}`);
      onDisconnect(playerRef).remove();
    } else {
      const rooms = this._getLocalRooms();
      if (!rooms[cleanCode]) {
        rooms[cleanCode] = {
          code: cleanCode,
          createdAt: now,
          hostId: this.playerId,
          status: 'active',
          players: {},
          lastKillEvent: null
        };
      }
      rooms[cleanCode].players[this.playerId] = playerPayload;
      this._saveLocalRooms(rooms);
    }

    this.roomCode = cleanCode;
    return cleanCode;
  }

  /**
   * Suscribe cambios en tiempo real de la sala (jugadores por brigada y eventos de eliminación)
   */
  subscribeToRoom(code, callback) {
    this.roomCode = code;
    this.roomCallback = callback;

    if (this.mode === 'firebase' && this.db) {
      const roomRef = ref(this.db, `rooms/${code}`);
      this.unsubscribeRoom = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.val());
        }
      });
    } else {
      this._emitLocalRoomState(code);
    }
  }

  /**
   * Cambia de Brigada (Alpha vs Bravo) o actualiza el alias/arma del jugador
   */
  async updatePlayerProfile(partialData) {
    if (!this.roomCode) return;
    const payload = {
      ...partialData,
      lastSeen: Date.now()
    };

    if (this.mode === 'firebase' && this.db) {
      const playerRef = ref(this.db, `rooms/${this.roomCode}/players/${this.playerId}`);
      await update(playerRef, payload);
    } else {
      const rooms = this._getLocalRooms();
      const room = rooms[this.roomCode];
      if (room && room.players && room.players[this.playerId]) {
        room.players[this.playerId] = {
          ...room.players[this.playerId],
          ...payload
        };
        this._saveLocalRooms(rooms);
      }
    }
  }

  /**
   * Actualiza telemetría GPS + Brújula del teléfono en tiempo real
   */
  async updateTelemetry({ lat, lng, heading }) {
    if (!this.roomCode) return;
    return this.updatePlayerProfile({ lat, lng, heading });
  }

  /**
   * Envía la orden de impacto y muerte instantánea sobre un jugador enemigo validado
   */
  async sendEliminationOrder({ victimId, victimAlias, killerAlias, killerBrigade, weaponName, distance }) {
    if (!this.roomCode || !victimId) return;

    const killEvent = {
      eventId: 'kill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      killerId: this.playerId,
      killerAlias,
      killerBrigade,
      victimId,
      victimAlias,
      weaponName,
      distance: Math.round(distance || 0)
    };

    if (this.mode === 'firebase' && this.db) {
      const updates = {};
      updates[`rooms/${this.roomCode}/players/${victimId}/alive`] = false;
      updates[`rooms/${this.roomCode}/lastKillEvent`] = killEvent;
      await update(ref(this.db), updates);
    } else {
      const rooms = this._getLocalRooms();
      const room = rooms[this.roomCode];
      if (room) {
        if (room.players[victimId]) {
          room.players[victimId].alive = false;
          room.players[victimId].deaths = (room.players[victimId].deaths || 0) + 1;
        }
        if (room.players[this.playerId]) {
          room.players[this.playerId].kills = (room.players[this.playerId].kills || 0) + 1;
        }
        room.lastKillEvent = killEvent;
        this._saveLocalRooms(rooms);
      }
    }
  }

  /**
   * Reaparece al jugador actual tras haber sido eliminado
   */
  async respawnSelf() {
    if (!this.roomCode) return;
    await this.updatePlayerProfile({ alive: true });
  }

  /**
   * Abandona la sala actual
   */
  async leaveRoom() {
    if (!this.roomCode) return;
    const code = this.roomCode;
    if (this.unsubscribeRoom) {
      this.unsubscribeRoom();
      this.unsubscribeRoom = null;
    }

    if (this.mode === 'firebase' && this.db) {
      const playerRef = ref(this.db, `rooms/${code}/players/${this.playerId}`);
      await remove(playerRef);
    } else {
      const rooms = this._getLocalRooms();
      if (rooms[code] && rooms[code].players) {
        delete rooms[code].players[this.playerId];
        this._saveLocalRooms(rooms);
      }
    }
    this.roomCode = null;
    this.roomCallback = null;
  }

  _getLocalRooms() {
    try {
      const raw = localStorage.getItem(LOCAL_ROOMS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _saveLocalRooms(rooms) {
    try {
      localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(rooms));
      if (this.broadcastChannel && this.roomCode) {
        this.broadcastChannel.postMessage({ roomCode: this.roomCode });
      }
      if (this.roomCode && this.roomCallback) {
        this._emitLocalRoomState(this.roomCode);
      }
    } catch (e) {
      console.warn('Error guardando sala local:', e);
    }
  }

  _emitLocalRoomState(code) {
    const rooms = this._getLocalRooms();
    if (rooms[code] && this.roomCallback) {
      this.roomCallback(rooms[code]);
    }
  }
}
