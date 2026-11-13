/**
 * vision.js
 * Motor de Visión Artificial Táctica + Telemetría GPS/Brújula (Cero Wallbang).
 * Analiza un micro-fotograma 640x480 ÚNICAMENTE en el instante exacto del disparo
 * y exclusivamente dentro del Cilindro Vertical Alargado Central.
 */

export const CYLINDER_HITBOX_RATIO = {
  // Proporción de cuerpo humano de pie centrado en la retícula (640x480)
  widthRatio: 0.18,   // Estrecho a los lados (18% del ancho)
  heightRatio: 0.54,  // Largo de arriba abajo (54% del alto)
  centerX: 0.50,
  centerY: 0.50
};

export class TacticalVisionSystem {
  constructor() {
    this.frameWidth = 640;
    this.frameHeight = 480;

    // Canvas offscreen 640x480 para captura instantánea bajo demanda
    this.captureCanvas = document.createElement('canvas');
    this.captureCanvas.width = this.frameWidth;
    this.captureCanvas.height = this.frameHeight;
    this.captureCtx = this.captureCanvas.getContext('2d', { willReadFrequently: true });

    // Canvas exclusivo para el recorte del cilindro central
    this.cylinderBounds = this._computeCylinderBounds();
    this.cylinderCanvas = document.createElement('canvas');
    this.cylinderCanvas.width = this.cylinderBounds.w;
    this.cylinderCanvas.height = this.cylinderBounds.h;
    this.cylinderCtx = this.cylinderCanvas.getContext('2d', { willReadFrequently: true });

    this.cocoModel = null;
    this.modelLoading = false;
    this.modelStatus = 'standby'; // 'standby' | 'loading' | 'ready' | 'fallback'

    // Telemetría propia (GPS + Brújula)
    this.telemetry = {
      lat: null,
      lng: null,
      accuracy: null,
      heading: 0,
      hasGps: false,
      hasCompass: false
    };
    this.geoWatchId = null;
    this.dummyTargetEnabled = false; // Opcional para Modo Prueba 1 Jugador sin otra persona enfrente
  }

  _computeCylinderBounds() {
    const w = Math.round(this.frameWidth * CYLINDER_HITBOX_RATIO.widthRatio);
    const h = Math.round(this.frameHeight * CYLINDER_HITBOX_RATIO.heightRatio);
    const x = Math.round(this.frameWidth * CYLINDER_HITBOX_RATIO.centerX - w / 2);
    const y = Math.round(this.frameHeight * CYLINDER_HITBOX_RATIO.centerY - h / 2);
    return { x, y, w, h };
  }

  /**
   * Carga asíncrona de TensorFlow.js + COCO-SSD para detección de silueta humana
   */
  async loadAiModel(onStatusChange) {
    if (this.cocoModel || this.modelLoading) return;
    this.modelLoading = true;
    this.modelStatus = 'loading';
    if (onStatusChange) onStatusChange('CARGANDO IA COCO-SSD...');

    try {
      if (window.cocoSsd) {
        this.cocoModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        this.modelStatus = 'ready';
        if (onStatusChange) onStatusChange('IA COCO-SSD ACTIVA');
      } else {
        this.modelStatus = 'fallback';
        if (onStatusChange) onStatusChange('VISIÓN CONTRASTE/SILUETA ACTIVA');
      }
    } catch (err) {
      console.warn('[TacticalVision] Fallback a análisis de silueta/contraste local:', err);
      this.modelStatus = 'fallback';
      if (onStatusChange) onStatusChange('VISIÓN CONTRASTE/SILUETA ACTIVA');
    } finally {
      this.modelLoading = false;
    }
  }

  /**
   * Inicia sensores de Geolocation API y DeviceOrientationEvent (Brújula)
   */
  startSensors(onTelemetryUpdate) {
    if ('geolocation' in navigator && !this.geoWatchId) {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.telemetry.lat = pos.coords.latitude;
          this.telemetry.lng = pos.coords.longitude;
          this.telemetry.accuracy = pos.coords.accuracy;
          this.telemetry.hasGps = true;
          if (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading)) {
            this.telemetry.heading = pos.coords.heading;
          }
          if (onTelemetryUpdate) onTelemetryUpdate(this.telemetry);
        },
        (err) => {
          console.warn('[TacticalVision] Aviso GPS:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 8000
        }
      );
    }

    const handleOrientation = (event) => {
      let heading = null;
      if (typeof event.webkitCompassHeading === 'number') {
        heading = event.webkitCompassHeading;
      } else if (typeof event.alpha === 'number') {
        heading = (360 - event.alpha) % 360;
      }
      if (heading !== null && !isNaN(heading)) {
        this.telemetry.heading = Math.round(heading);
        this.telemetry.hasCompass = true;
        if (onTelemetryUpdate) onTelemetryUpdate(this.telemetry);
      }
    };

    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        })
        .catch(() => {});
    } else {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
  }

  stopSensors() {
    if (this.geoWatchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
  }

  /**
   * VALIDACIÓN ESTRICTA EN EL INSTANTE DEL DISPARO (CERO WALLBANG)
   * Se ejecuta ÚNICAMENTE cuando el jugador presiona el gatillo.
   * Analiza el micro-fotograma 640x480 dentro del Cilindro Largo Central.
   */
  async analyzeShotOnTrigger(videoEl) {
    const { x, y, w, h } = this.cylinderBounds;

    // Si el maniquí táctico virtual de prueba está activo en Modo 1 Jugador
    if (this.dummyTargetEnabled) {
      return {
        targetDetected: true,
        method: 'SILUETA-PRUEBA-ACTIVA',
        confidence: 0.96,
        wallBlocked: false,
        reason: 'Silueta confirmada en el cilindro central'
      };
    }

    if (!videoEl || videoEl.readyState < 2) {
      return {
        targetDetected: false,
        method: 'NO-CAMERA',
        confidence: 0,
        wallBlocked: true,
        reason: 'Cámara sin señal de video activa'
      };
    }

    // 1. Capturar micro-fotograma 640x480 en este milisegundo exacto
    this.captureCtx.drawImage(videoEl, 0, 0, this.frameWidth, this.frameHeight);

    // 2. Extraer exclusivamente los píxeles dentro del Cilindro Vertical Central
    this.cylinderCtx.clearRect(0, 0, w, h);
    this.cylinderCtx.drawImage(this.captureCanvas, x, y, w, h, 0, 0, w, h);

    // 3. Evaluar obstrucción por pared/puerta lisa y contraste de silueta vertical dentro del cilindro
    const pixelStats = this._analyzeCylinderSilhouettePixels(this.cylinderCtx, w, h);

    if (pixelStats.isUniformWall) {
      return {
        targetDetected: false,
        method: 'ZERO-WALLBANG-FILTER',
        confidence: pixelStats.silhouetteScore,
        wallBlocked: true,
        reason: 'Pared o superficie uniforme bloqueando el cilindro central'
      };
    }

    // 4. Si COCO-SSD está cargado, verificar detección de 'person' solapada con el Cilindro Central
    if (this.cocoModel) {
      try {
        const predictions = await this.cocoModel.detect(this.captureCanvas, 6, 0.30);
        const personHits = predictions.filter((pred) => {
          if (pred.class !== 'person') return false;
          const [bx, by, bw, bh] = pred.bbox;
          return this._intersectsCentralCylinder(bx, by, bw, bh);
        });

        if (personHits.length > 0) {
          const best = personHits.reduce((a, b) => (a.score > b.score ? a : b));
          return {
            targetDetected: true,
            method: 'COCO-SSD PERSON',
            confidence: Number(best.score.toFixed(2)),
            wallBlocked: false,
            reason: `Silueta humana validada (${Math.round(best.score * 100)}%)`
          };
        }
      } catch (err) {
        console.warn('[TacticalVision] Error ejecutando inferencia puntual:', err);
      }
    }

    // 5. Validación de silueta vertical y contraste de figura dentro del cilindro
    // Permite detectar un jugador encuadrado incluso en baja luz o camuflaje parcial si no hay pared lisa
    if (pixelStats.hasVerticalFigure) {
      return {
        targetDetected: true,
        method: 'SILUETA-CILINDRO',
        confidence: Number(pixelStats.silhouetteScore.toFixed(2)),
        wallBlocked: false,
        reason: `Objetivo encuadrado en cilindro (${Math.round(pixelStats.silhouetteScore * 100)}%)`
      };
    }

    return {
      targetDetected: false,
      method: this.cocoModel ? 'COCO-SSD + SILUETA' : 'SILUETA-CILINDRO',
      confidence: Number(pixelStats.silhouetteScore.toFixed(2)),
      wallBlocked: true,
      reason: 'Sin silueta válida dentro del cilindro vertical'
    };
  }

  /**
   * Comprueba si el bounding box de una persona en el frame 640x480 cruza el eje del Cilindro Central
   */
  _intersectsCentralCylinder(bx, by, bw, bh) {
    const cyl = this.cylinderBounds;
    const cylCenterX = cyl.x + cyl.w / 2;
    const cylCenterY = cyl.y + cyl.h / 2;

    // El centro horizontal de la retícula debe caer dentro o muy cerca del cuerpo detectado
    const horizontalAligned =
      cylCenterX >= bx - cyl.w * 0.25 && cylCenterX <= bx + bw + cyl.w * 0.25;

    // Debe existir solapamiento vertical sustancial con el cilindro central
    const overlapY = Math.max(0, Math.min(cyl.y + cyl.h, by + bh) - Math.max(cyl.y, by));
    const verticalAligned = overlapY >= Math.min(cyl.h * 0.32, bh * 0.45) ||
      (cylCenterY >= by && cylCenterY <= by + bh);

    return horizontalAligned && verticalAligned;
  }

  /**
   * Analiza los píxeles exclusivamente dentro del cilindro vertical central:
   * - Detecta paredes lisas / puertas cerradas (baja densidad de bordes y baja diferencia centro-borde).
   * - Calcula la firma vertical de silueta (contraste entre el núcleo central del cilindro y sus bordes).
   */
  _analyzeCylinderSilhouettePixels(ctx, w, h) {
    const imgData = ctx.getImageData(0, 0, w, h).data;
    let sumLum = 0;
    let sumSqLum = 0;
    let edgeAccum = 0;
    let coreContrastAccum = 0;
    let sampleCount = 0;

    const stride = 2;
    for (let py = stride; py < h - stride; py += stride) {
      // Máscara elíptica/cilíndrica para ignorar esquinas fuera de las tapas redondeadas
      const normY = (py - h / 2) / (h / 2);
      for (let px = stride; px < w - stride; px += stride) {
        const normX = (px - w / 2) / (w / 2);
        if (normX * normX * 0.7 + normY * normY * 0.15 > 1.0) continue;

        const idx = (py * w + px) * 4;
        const idxRight = (py * w + (px + stride)) * 4;
        const idxDown = ((py + stride) * w + px) * 4;

        const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
        const lumRight =
          0.299 * imgData[idxRight] + 0.587 * imgData[idxRight + 1] + 0.114 * imgData[idxRight + 2];
        const lumDown =
          0.299 * imgData[idxDown] + 0.587 * imgData[idxDown + 1] + 0.114 * imgData[idxDown + 2];

        const grad = Math.abs(lum - lumRight) + Math.abs(lum - lumDown);
        edgeAccum += grad;
        sumLum += lum;
        sumSqLum += lum * lum;
        sampleCount++;

        if (Math.abs(normX) < 0.45) {
          coreContrastAccum += grad * 1.25;
        }
      }
    }

    if (sampleCount === 0) {
      return { isUniformWall: true, hasVerticalFigure: false, silhouetteScore: 0 };
    }

    const meanLum = sumLum / sampleCount;
    const variance = Math.max(0, sumSqLum / sampleCount - meanLum * meanLum);
    const stdDev = Math.sqrt(variance);
    const meanEdge = edgeAccum / sampleCount;

    // Si la desviación estándar y los bordes son muy bajos, es una pared lisa, puerta o cielo vacío
    const isUniformWall = stdDev < 16 || meanEdge < 9.5;

    // Puntuación normalizada de silueta dentro del cilindro (0.0 a 1.0)
    const silhouetteScore = Math.min(
      0.99,
      (stdDev / 58) * 0.5 + (meanEdge / 34) * 0.5
    );

    const hasVerticalFigure = !isUniformWall && silhouetteScore >= 0.46;

    return {
      isUniformWall,
      hasVerticalFigure,
      silhouetteScore
    };
  }

  /**
   * Valida si un jugador de la brigada enemiga está en el ángulo de la brújula y dentro del alcance
   * del arma equipada.
   */
  findHitEnemyPlayer({ myId, myBrigade, weaponMaxRange, roomPlayers }) {
    if (!roomPlayers) return null;

    const enemies = Object.values(roomPlayers).filter(
      (p) => p && p.id !== myId && p.brigade !== myBrigade && p.alive !== false
    );

    if (enemies.length === 0) return null;

    const myLat = this.telemetry.lat;
    const myLng = this.telemetry.lng;
    const myHeading = this.telemetry.heading || 0;

    let bestCandidate = null;
    let bestScore = Infinity;

    for (const enemy of enemies) {
      // Si ambos teléfonos reportan coordenadas GPS válidas, validamos distancia real y ángulo
      if (
        typeof myLat === 'number' &&
        typeof myLng === 'number' &&
        typeof enemy.lat === 'number' &&
        typeof enemy.lng === 'number'
      ) {
        const distMeters = TacticalVisionSystem.calculateDistanceMeters(
          myLat,
          myLng,
          enemy.lat,
          enemy.lng
        );

        // Si el enemigo está fuera del alcance máximo del arma, el disparo no llega
        if (distMeters > weaponMaxRange) {
          continue;
        }

        // Si ambos teléfonos están muy cerca (< 20m, ej. indoor/patio con imprecisión GPS),
        // la validación visual del cilindro central manda sin penalizar el ruido angular del GPS.
        if (distMeters <= 20) {
          if (distMeters < bestScore) {
            bestScore = distMeters;
            bestCandidate = { enemy, distance: distMeters };
          }
          continue;
        }

        const bearingToEnemy = TacticalVisionSystem.calculateBearingDegrees(
          myLat,
          myLng,
          enemy.lat,
          enemy.lng
        );
        const angleDiff = TacticalVisionSystem.smallestAngleDiff(myHeading, bearingToEnemy);

        // Cono angular táctico permitido (±28 grados respecto a la brújula)
        if (angleDiff <= 28 && angleDiff < bestScore) {
          bestScore = angleDiff;
          bestCandidate = { enemy, distance: distMeters };
        }
      } else {
        // En interiores donde el GPS aún no fijó satélites, la validación estricta de silueta
        // en el cilindro central sin paredes ("Cero Wallbang") adjudica el impacto al enemigo activo.
        return {
          enemy,
          distance: Math.min(18, weaponMaxRange)
        };
      }
    }

    return bestCandidate;
  }

  /**
   * Fórmula de Haversine para calcular distancia en metros entre dos coordenadas GPS
   */
  static calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calcula el azimut (0° - 360°) desde el tirador hacia las coordenadas del enemigo
   */
  static calculateBearingDegrees(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  static smallestAngleDiff(a, b) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }
}
