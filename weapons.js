/**
 * weapons.js
 * Sistema de Armería Modular, Categorías Dinámicas y "Taller de Armas" con persistencia en localStorage.
 * Soporta carga de imágenes PNG/JPG desde galería móvil a Base64 DataURL y creación de nuevas categorías.
 */

const STORAGE_CATEGORIES_KEY = 'tactical_armory_categories_v1';
const STORAGE_WEAPONS_KEY = 'tactical_armory_weapons_v1';
const STORAGE_SELECTED_WEAPON_KEY = 'tactical_selected_weapon_id_v1';

export const BASE_CATEGORIES = [
  'Pistolas',
  'Fusiles de Asalto',
  'Francotiradores'
];

/**
 * Genera ilustraciones SVG tácticas en primera persona para las armas base
 */
function createWeaponSvgDataUrl(type, accentColor, label) {
  let svgBody = '';

  if (type === 'pistol') {
    svgBody = `
      <g transform="translate(30, 20)">
        <!-- Corredera superior -->
        <rect x="60" y="55" width="230" height="44" rx="6" fill="#1b222c" stroke="${accentColor}" stroke-width="2.5"/>
        <!-- Estrías de corredera -->
        <line x1="210" y1="62" x2="205" y2="92" stroke="#394658" stroke-width="4"/>
        <line x1="222" y1="62" x2="217" y2="92" stroke="#394658" stroke-width="4"/>
        <line x1="234" y1="62" x2="229" y2="92" stroke="#394658" stroke-width="4"/>
        <line x1="246" y1="62" x2="241" y2="92" stroke="#394658" stroke-width="4"/>
        <!-- Cañón / Supresor roscado -->
        <rect x="30" y="64" width="32" height="24" rx="3" fill="#0f141b" stroke="#49576b" stroke-width="2"/>
        <!-- Miras de tritio -->
        <rect x="68" y="47" width="8" height="8" fill="${accentColor}"/>
        <rect x="272" y="47" width="12" height="8" fill="${accentColor}"/>
        <!-- Ventana de expulsión -->
        <rect x="145" y="58" width="46" height="16" rx="2" fill="#0b0e12" stroke="#55647a" stroke-width="1.5"/>
        <!-- Armazón y riel Picatinny -->
        <path d="M62 99 L285 99 L295 125 L265 235 L205 235 L218 132 L145 132 L62 118 Z" fill="#131820" stroke="#334155" stroke-width="2"/>
        <!-- Guardamonte y gatillo -->
        <path d="M155 128 L155 162 L212 162" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
        <path d="M188 130 Q176 146 184 156" fill="none" stroke="${accentColor}" stroke-width="4" stroke-linecap="round"/>
        <!-- Textura empuñadura -->
        <rect x="218" y="138" width="45" height="82" rx="6" transform="rotate(-8 218 138)" fill="#0d1117" stroke="${accentColor}" stroke-width="1.2" stroke-dasharray="4 4"/>
        <text x="90" y="83" fill="${accentColor}" font-family="monospace" font-weight="bold" font-size="13">${label}</text>
      </g>
    `;
  } else if (type === 'rifle') {
    svgBody = `
      <g transform="translate(10, 15)">
        <!-- Cañón y apagallamas -->
        <rect x="8" y="78" width="58" height="14" rx="2" fill="#0f141b" stroke="#475569" stroke-width="2"/>
        <!-- Guardamanos M-LOK con riel superior -->
        <rect x="64" y="65" width="145" height="42" rx="4" fill="#18202c" stroke="${accentColor}" stroke-width="2"/>
        <rect x="78" y="78" width="26" height="10" rx="3" fill="#090d12"/>
        <rect x="116" y="78" width="26" height="10" rx="3" fill="#090d12"/>
        <rect x="154" y="78" width="26" height="10" rx="3" fill="#090d12"/>
        <!-- Mira Holográfica EOTech / Red Dot -->
        <path d="M215 32 L268 32 L274 63 L210 63 Z" fill="#131922" stroke="${accentColor}" stroke-width="2.2"/>
        <circle cx="242" cy="47" r="6" fill="none" stroke="#ff2a4b" stroke-width="2"/>
        <circle cx="242" cy="47" r="2" fill="#ff2a4b"/>
        <!-- Cajón de mecanismos (Upper/Lower Receiver) -->
        <path d="M208 63 L325 63 L335 128 L208 122 Z" fill="#1e2736" stroke="#475569" stroke-width="2"/>
        <!-- Ventana de expulsión -->
        <rect x="230" y="74" width="48" height="16" rx="2" fill="#090c10" stroke="${accentColor}" stroke-width="1.5"/>
        <!-- Cargador curvo STANAG / Polímero -->
        <path d="M216 122 L258 122 L244 232 L196 224 Z" fill="#121720" stroke="${accentColor}" stroke-width="2"/>
        <!-- Empuñadura pistolete -->
        <path d="M288 126 L326 126 L342 212 L302 212 Z" fill="#0f141c" stroke="#334155" stroke-width="2"/>
        <!-- Culata táctica retráctil -->
        <path d="M326 68 L385 68 L385 135 L334 114 Z" fill="#141a23" stroke="#334155" stroke-width="2"/>
        <text x="225" y="108" fill="${accentColor}" font-family="monospace" font-weight="bold" font-size="12">${label}</text>
      </g>
    `;
  } else {
    // Sniper
    svgBody = `
      <g transform="translate(5, 18)">
        <!-- Freno de boca pesado Cal .50 / .338 -->
        <polygon points="4,72 34,64 34,98 4,90" fill="#11161f" stroke="${accentColor}" stroke-width="2"/>
        <!-- Cañón flotante acanalado largo -->
        <rect x="34" y="75" width="140" height="12" fill="#1a222d" stroke="#475569" stroke-width="2"/>
        <!-- Bípode plegado -->
        <rect x="115" y="92" width="55" height="8" rx="3" fill="#0f141c" stroke="#334155" stroke-width="1.5"/>
        <!-- Mira Telescópica de Largo Alcance -->
        <path d="M180 24 L310 30 L310 50 L180 56 Z" fill="#0f141c" stroke="${accentColor}" stroke-width="2.2"/>
        <rect x="225" y="18" width="22" height="12" rx="2" fill="#1e293b" stroke="${accentColor}" stroke-width="1.5"/>
        <line x1="205" y1="54" x2="205" y2="66" stroke="#64748b" stroke-width="6"/>
        <line x1="285" y1="52" x2="285" y2="66" stroke="#64748b" stroke-width="6"/>
        <!-- Chasis de francotirador -->
        <path d="M168 66 L338 66 L345 118 L168 112 Z" fill="#1b2432" stroke="${accentColor}" stroke-width="2"/>
        <!-- Cerrojo manual -->
        <circle cx="288" cy="88" r="8" fill="${accentColor}"/>
        <line x1="265" y1="82" x2="288" y2="88" stroke="#94a3b8" stroke-width="4"/>
        <!-- Cargador de gran calibre -->
        <rect x="208" y="112" width="54" height="78" rx="4" fill="#0d1219" stroke="${accentColor}" stroke-width="2"/>
        <!-- Culata de precisión -->
        <path d="M338 70 L390 70 L390 142 L342 118 Z" fill="#121822" stroke="#475569" stroke-width="2"/>
        <text x="182" y="96" fill="${accentColor}" font-family="monospace" font-weight="bold" font-size="12">${label}</text>
      </g>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">${svgBody}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.trim());
}

export const DEFAULT_WEAPONS = [
  {
    id: 'glock19_gen5',
    name: 'Glock 19 Gen5 Tactical',
    category: 'Pistolas',
    caliber: '9x19mm Parabellum',
    magCapacity: 15,
    fireRateMs: 175,
    reloadTimeMs: 1550,
    maxRangeMeters: 35,
    imageDataUrl: createWeaponSvgDataUrl('pistol', '#00ff88', 'G19-9MM'),
    isCustom: false
  },
  {
    id: 'sig_m17_combat',
    name: 'Sig Sauer M17 Combat',
    category: 'Pistolas',
    caliber: '.40 S&W HollowPoint',
    magCapacity: 17,
    fireRateMs: 195,
    reloadTimeMs: 1700,
    maxRangeMeters: 42,
    imageDataUrl: createWeaponSvgDataUrl('pistol', '#fbbf24', 'SIG-M17'),
    isCustom: false
  },
  {
    id: 'm4a1_sopmod',
    name: 'M4A1 SOPMOD Block II',
    category: 'Fusiles de Asalto',
    caliber: '5.56x45mm NATO',
    magCapacity: 30,
    fireRateMs: 110,
    reloadTimeMs: 2200,
    maxRangeMeters: 125,
    imageDataUrl: createWeaponSvgDataUrl('rifle', '#00ff88', 'M4A1-5.56'),
    isCustom: false
  },
  {
    id: 'ak103_zenit',
    name: 'AK-103 Zenitco Alpha',
    category: 'Fusiles de Asalto',
    caliber: '7.62x39mm WP',
    magCapacity: 30,
    fireRateMs: 135,
    reloadTimeMs: 2450,
    maxRangeMeters: 145,
    imageDataUrl: createWeaponSvgDataUrl('rifle', '#38bdf8', 'AK103-7.62'),
    isCustom: false
  },
  {
    id: 'awm_l115a3',
    name: 'AWM L115A3 Magnum',
    category: 'Francotiradores',
    caliber: '.338 Lapua Magnum',
    magCapacity: 5,
    fireRateMs: 1050,
    reloadTimeMs: 3200,
    maxRangeMeters: 320,
    imageDataUrl: createWeaponSvgDataUrl('sniper', '#f43f5e', 'AWM-.338'),
    isCustom: false
  },
  {
    id: 'barrett_m82a1',
    name: 'Barrett M82A1 Anti-Mat',
    category: 'Francotiradores',
    caliber: '.50 BMG (12.7x99mm)',
    magCapacity: 10,
    fireRateMs: 820,
    reloadTimeMs: 3600,
    maxRangeMeters: 480,
    imageDataUrl: createWeaponSvgDataUrl('sniper', '#a855f7', 'M82-.50BMG'),
    isCustom: false
  }
];

export class ArmoryManager {
  constructor() {
    this.categories = this._loadCategories();
    this.weapons = this._loadWeapons();
    this.selectedWeaponId = this._loadSelectedWeaponId();
  }

  _loadCategories() {
    try {
      const saved = localStorage.getItem(STORAGE_CATEGORIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...BASE_CATEGORIES];
          parsed.forEach((cat) => {
            if (cat && !merged.includes(cat)) {
              merged.push(cat);
            }
          });
          return merged;
        }
      }
    } catch (e) {
      console.warn('Error cargando categorías de armería:', e);
    }
    return [...BASE_CATEGORIES];
  }

  _saveCategories() {
    try {
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(this.categories));
    } catch (e) {
      console.error('Error guardando categorías:', e);
    }
  }

  _loadWeapons() {
    try {
      const saved = localStorage.getItem(STORAGE_WEAPONS_KEY);
      const customWeapons = saved ? JSON.parse(saved) : [];
      if (Array.isArray(customWeapons)) {
        return [...DEFAULT_WEAPONS, ...customWeapons];
      }
    } catch (e) {
      console.warn('Error cargando armas personalizadas:', e);
    }
    return [...DEFAULT_WEAPONS];
  }

  _saveCustomWeapons() {
    try {
      const customOnly = this.weapons.filter((w) => w.isCustom);
      localStorage.setItem(STORAGE_WEAPONS_KEY, JSON.stringify(customOnly));
    } catch (e) {
      console.error('Error guardando armas en localStorage (posible límite de cuota):', e);
      throw new Error('No se pudo guardar el arma: la imagen es demasiado pesada para localStorage.');
    }
  }

  _loadSelectedWeaponId() {
    const saved = localStorage.getItem(STORAGE_SELECTED_WEAPON_KEY);
    if (saved && this.weapons.some((w) => w.id === saved)) {
      return saved;
    }
    return 'm4a1_sopmod';
  }

  getCategories() {
    return [...this.categories];
  }

  /**
   * Crea una nueva categoría dinámica (ej. "Escopetas", "Subfusiles", "Armas Pesadas")
   */
  addCategory(categoryName) {
    const clean = (categoryName || '').trim();
    if (!clean) {
      throw new Error('Ingresa un nombre válido para la categoría.');
    }
    const existing = this.categories.find((c) => c.toLowerCase() === clean.toLowerCase());
    if (existing) {
      return existing;
    }
    this.categories.push(clean);
    this._saveCategories();
    return clean;
  }

  getAllWeapons() {
    return [...this.weapons];
  }

  getWeaponsByCategory(category) {
    if (!category || category === 'Todas') {
      return this.getAllWeapons();
    }
    return this.weapons.filter((w) => w.category.toLowerCase() === category.toLowerCase());
  }

  getWeaponById(id) {
    return this.weapons.find((w) => w.id === id) || this.weapons[0];
  }

  getSelectedWeapon() {
    return this.getWeaponById(this.selectedWeaponId);
  }

  selectWeapon(id) {
    const found = this.getWeaponById(id);
    if (found) {
      this.selectedWeaponId = found.id;
      localStorage.setItem(STORAGE_SELECTED_WEAPON_KEY, found.id);
    }
    return found;
  }

  /**
   * Crea y guarda una nueva arma personalizada desde el "Taller de Armas"
   */
  createCustomWeapon({
    name,
    category,
    newCategoryName,
    caliber,
    magCapacity,
    fireRateMs,
    reloadTimeMs,
    maxRangeMeters,
    imageDataUrl
  }) {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('Debes asignar un nombre táctico al arma.');
    }

    let finalCategory = (category || '').trim();
    if (finalCategory === '__new__') {
      finalCategory = this.addCategory(newCategoryName);
    } else if (!this.categories.includes(finalCategory)) {
      finalCategory = this.addCategory(finalCategory || 'Personalizadas');
    }

    const weaponObj = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      category: finalCategory,
      caliber: (caliber || '9x19mm').trim(),
      magCapacity: Math.max(1, Math.min(500, parseInt(magCapacity, 10) || 30)),
      fireRateMs: Math.max(40, Math.min(5000, parseInt(fireRateMs, 10) || 140)),
      reloadTimeMs: Math.max(300, Math.min(15000, parseInt(reloadTimeMs, 10) || 2100)),
      maxRangeMeters: Math.max(5, Math.min(2500, parseInt(maxRangeMeters, 10) || 100)),
      imageDataUrl: imageDataUrl || createWeaponSvgDataUrl('rifle', '#00ff88', cleanName.substring(0, 8).toUpperCase()),
      isCustom: true,
      createdAt: Date.now()
    };

    this.weapons.push(weaponObj);
    this._saveCustomWeapons();
    this.selectWeapon(weaponObj.id);
    return weaponObj;
  }

  /**
   * Elimina un arma personalizada creada por el usuario
   */
  deleteCustomWeapon(weaponId) {
    const idx = this.weapons.findIndex((w) => w.id === weaponId && w.isCustom);
    if (idx === -1) return false;
    this.weapons.splice(idx, 1);
    this._saveCustomWeapons();
    if (this.selectedWeaponId === weaponId) {
      this.selectWeapon(DEFAULT_WEAPONS[0].id);
    }
    return true;
  }

  /**
   * Procesa y optimiza una imagen subida desde la galería del celular (<input type="file">)
   * Redimensiona a máximo 600px de ancho para asegurar fluidez a 60fps y ajuste en localStorage.
   */
  static processUploadedWeaponImage(file, removeLightBg = false) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Selecciona un archivo de imagen válido (PNG, JPG, WEBP).'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 560;
          const maxHeight = 360;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          if (removeLightBg) {
            const imgData = ctx.getImageData(0, 0, width, height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i];
              const g = d[i + 1];
              const b = d[i + 2];
              // Hacer transparentes píxeles casi blancos de fotos con fondo claro
              if (r > 235 && g > 235 && b > 235) {
                d[i + 3] = 0;
              }
            }
            ctx.putImageData(imgData, 0, 0);
          }

          const dataUrl = canvas.toDataURL('image/png', 0.88);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('No se pudo decodificar la imagen seleccionada.'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Error leyendo el archivo desde la galería.'));
      reader.readAsDataURL(file);
    });
  }
}
