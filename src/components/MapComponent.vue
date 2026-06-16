<script setup>
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import markerIcon from '/marker3.png'
</script>

<script>
const FLOORS = [
  { label: "Hall 7.1", file: "/maps/hall1.geojson", altMin: 90,  altMax: 95  },
  { label: "Hall 7.2", file: "/maps/hall2.geojson", altMin: 96,  altMax: 100 },
  { label: "Hall 7.3", file: "/maps/hall3.geojson", altMin: 101, altMax: 110 },
]

const JOURS_EN = {
  'Mercredi': 'Wednesday', 'Jeudi': 'Thursday',
  'Vendredi': 'Friday',    'Samedi': 'Saturday',
}
const JOURS_COULEURS = {
  'Mercredi': '#094575',
  'Jeudi':    '#2d6fa8',
  'Vendredi': '#7a9fbf',
  'Samedi':   '#a8bfce',
}
// Petit point opaque avec halo lumineux et minuscule point blanc central
const DOT_COLORS = {
  top50:     '#094575',
  imagerie:  '#2d6fa8',
  recharge:  '#7a9fbf',
  collegue:  '#a8bfce',
}

function makeCircle(latlng, color = '#094575') {
  const icon = L.divIcon({
    className: '',
    html: `<div class="stand-dot" style="background:${color};box-shadow:0 0 0 3px rgba(255,255,255,0.6),0 0 8px 4px ${color}88"><div class="stand-dot-inner"></div></div>`,
    iconSize:    [14, 14],
    iconAnchor:  [7, 7],
    popupAnchor: [0, -7],
  })
  return L.marker(latlng, { icon })
}

// Popup pour 1 ou plusieurs stands sur le même polygone
function buildPopup(stands) {
  if (stands.length === 1) return buildSinglePopup(stands[0])

  // Plusieurs stands : liste avec séparateurs
  return `
    <div class="popup-stand popup-multi">
      <div class="popup-multi-header">${stands.length} booths at this location</div>
      ${stands.map((s, i) => `
        <div class="popup-multi-item${i < stands.length - 1 ? ' popup-multi-sep' : ''}">
          ${buildSinglePopup(s)}
        </div>`).join('')}
    </div>`
}

function buildSinglePopup(stand) {
  const joursHtml = stand.jours.map(j => {
    const c = JOURS_COULEURS[j] || '#666'
    return `<span class="popup-jour" style="background:${c}">${JOURS_EN[j] || j}</span>`
  }).join(' ')

  const photoHtml = stand.photo
    ? `<img src="${stand.photo}" class="popup-photo" alt="${stand.nom}" />`
    : `<div class="popup-photo-placeholder">📷 Photo coming soon</div>`

  return `
    <div class="popup-single">
      ${photoHtml}
      <div class="popup-nom">${stand.nom}</div>
      <div class="popup-meta">${stand.stand_id}${stand.espace ? ' · ' + stand.espace : ''}</div>
      <div class="popup-pitch">${stand.pitch}</div>
      <div class="popup-jours">${joursHtml}</div>
    </div>`
}

export default {
  expose: ['zoomSurStand', 'toggleCouches', 'setFloor'],

  data() {
    return {
      map: null, iconGeoloc: null, geoJsonLayer: null, userCircle: null,
      currentFloor: 0, autoFloor: true, altitudeActuelle: null,
      floors: FLOORS, showFloorPanel: true, showLayerPanel: false,
      layerVisible: { top50: true, imagerie: true, recharge: true, collegue: true, itineraire: false },
      thematicLayers: { top50: null, imagerie: null, recharge: null, collegue: null, itineraire: null },
      standsData: { top50: [], imagerie: [], recharge: [] },
      // qgis_id → [stand, stand, ...] par catégorie
      indexes: { top50: {}, imagerie: {}, recharge: {} },
      // qgis_id → [lat, lng]
      centroidsCache: {},
    }
  },

  methods: {

    async chargerStands() {
      const res = await fetch('/stands.json')
      this.standsData = await res.json()
      // Construire les index qgis_id → tableau de stands
      ;['top50', 'imagerie', 'recharge'].forEach(cat => {
        const idx = {}
        this.standsData[cat].forEach(s => {
          const id = s.qgis_id.trim()
          if (!id) return
          if (!idx[id]) idx[id] = []
          idx[id].push(s)
        })
        this.indexes[cat] = idx
      })
      this.chargerCouchesThematiques()
    },

    buildCentroids(geojsonData) {
      const cache = {}
      geojsonData.features?.forEach(f => {
        const id = f.properties?.ID?.trim()
        if (!id) return
        try {
          const center = L.geoJSON(f).getBounds().getCenter()
          cache[id] = [center.lat, center.lng]
        } catch (e) {}
      })
      this.centroidsCache = cache
    },

    chargerCouchesThematiques() {
      ;['top50', 'imagerie', 'recharge'].forEach(cat => {
        if (this.thematicLayers[cat]) { this.map.removeLayer(this.thematicLayers[cat]); this.thematicLayers[cat] = null }
      })
      if (!this.geoJsonLayer || !Object.keys(this.centroidsCache).length) return

      ;['top50', 'imagerie', 'recharge'].forEach(cat => {
        const idx   = this.indexes[cat]
        const group = L.layerGroup()

        Object.entries(this.centroidsCache).forEach(([id, latlng]) => {
          const stands = idx[id]
          if (!stands || !stands.length) return
          const circle = makeCircle(latlng, DOT_COLORS[cat])
          circle.bindPopup(buildPopup(stands), { maxWidth: 300 })
          group.addLayer(circle)
        })

        this.thematicLayers[cat] = group
        if (this.layerVisible[cat]) group.addTo(this.map)
      })

      this.chargerCoucheCollegue()
    },

    chargerCoucheCollegue() {
      if (this.thematicLayers.collegue) { this.map.removeLayer(this.thematicLayers.collegue); this.thematicLayers.collegue = null }
      if (!this.layerVisible.collegue) return
      const data  = JSON.parse(localStorage.getItem('collegue_stands') || '[]')
      const group = L.layerGroup()
      data.forEach(item => {
        if (!item.lat || !item.lng) return
        makeCircle([item.lat, item.lng], DOT_COLORS.collegue)
          .bindPopup(`
            <div class="popup-single">
              <div class="popup-nom">${item.nom || '?'}</div>
              <div class="popup-meta">${item.stand_id || ''}</div>
              <div class="popup-pitch">${item.interet || ''}</div>
              <div style="margin-top:6px;font-size:0.75rem;color:#888">👤 Colleague's note</div>
            </div>`)
          .addTo(group)
      })
      this.thematicLayers.collegue = group
      if (this.layerVisible.collegue) group.addTo(this.map)
    },

    toggleLayer(nom) {
      this.layerVisible[nom] = !this.layerVisible[nom]
      const layer = this.thematicLayers[nom]
      if (!layer) return
      this.layerVisible[nom] ? layer.addTo(this.map) : this.map.removeLayer(layer)
    },

    // Appelé depuis HomeView quand on sélectionne un stand dans la recherche
    zoomSurStand(stand) {
      const latlng = this.centroidsCache[stand.qgis_id?.trim()]
      if (latlng) {
        this.map.setView(latlng, 21)
        // Ouvre le popup de la bonne couche
        const cat = ['top50','imagerie','recharge'].find(c => this.indexes[c][stand.qgis_id?.trim()])
        if (cat && this.thematicLayers[cat]) {
          this.thematicLayers[cat].eachLayer(layer => {
            const ll = layer.getLatLng?.()
            if (ll && Math.abs(ll.lat - latlng[0]) < 0.000015) layer.openPopup()
          })
        }
      } else {
        this.map.setView([48.8397, 2.2918], 18)
      }
    },

    toggleCouches() { this.showLayerPanel = !this.showLayerPanel },

    setFloor(index, auto = false) {
      if (!auto && this.autoFloor) this.autoFloor = false
      if (this.currentFloor === index) return
      this.currentFloor = index
      this.chargerEtage(index)
    },
    repasserAuto() { this.autoFloor = true },

    detecterEtageParAltitude(altitude) {
      if (altitude === null) return
      this.altitudeActuelle = Math.round(altitude * 10) / 10
      if (!this.autoFloor) return
      const etage = FLOORS.findIndex(f => altitude >= f.altMin && altitude < f.altMax)
      if (etage !== -1 && etage !== this.currentFloor) { this.currentFloor = etage; this.chargerEtage(etage) }
    },

    chargerEtage(index) {
      if (this.geoJsonLayer) { this.map.removeLayer(this.geoJsonLayer); this.geoJsonLayer = null }
      ;['top50','imagerie','recharge','collegue'].forEach(cat => {
        if (this.thematicLayers[cat]) { this.map.removeLayer(this.thematicLayers[cat]); this.thematicLayers[cat] = null }
      })
      this.centroidsCache = {}

      fetch(FLOORS[index].file)
        .then(r => r.json())
        .then(data => {
          this.geoJsonLayer = L.geoJSON(data, {
            style: (feature) => {
              const id   = feature.properties?.ID?.trim()
              const nom = (feature.properties?.Nom || '').trim().toLowerCase()
              // JCDecaux : remplissage bleu foncé
              if (id === '1G02') {
                return { color: '#094575', weight: 1.5, fillColor: '#094575', fillOpacity: 0.85 }
              }
              // Escaliers / services : bleu clair
              if (nom === 'escaliers' || nom === 'services' || nom === 'escaliers et ascenseurs') {
                return { color: '#094575', weight: 1, fillColor: '#7a9fbf', fillOpacity: 0.5 }
              }
              return { color: '#094575', weight: 1.5, fillColor: '#ffffff', fillOpacity: 0.5 }
            },
            onEachFeature: (feature, layer) => {
              const id   = (feature.properties?.ID   || '').trim()
              const name = (feature.properties?.name || '').trim()

              // Stands sans ID mais avec un nom → label texte fixe centré (repère)
              if (!id && name) {
                layer.bindTooltip(name, {
                  permanent: true, direction: 'center',
                  className: 'label-stand-fixe', interactive: false,
                })
                return
              }
              // JCDecaux : label "JCDecaux" blanc bold centré fixe — pas de tooltip survol en plus
              if (id === '1G02') {
                layer.bindTooltip('JCDecaux', {
                  permanent: true, direction: 'center',
                  className: 'label-jcd', interactive: false,
                })
                return
              }
              // Tooltip survol pour les autres stands nommés
              if (name) layer.bindTooltip(name)
            }
          }).addTo(this.map)
          this.map.fitBounds(this.geoJsonLayer.getBounds())
          this.buildCentroids(data)
          this.chargerCouchesThematiques()
        })
        .catch(err => console.error('Erreur chargement plan :', err))
    },

    createMap() {
      this.map = L.map('mapContenant').setView([48.8397, 2.2918], 18)
      L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
        minZoom: 0, maxZoom: 20, ext: 'png',
        attribution: '&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map)

      this.iconGeoloc = L.icon({ iconUrl: markerIcon, iconSize: [28, 42] })

      navigator.geolocation.watchPosition(
        ({ coords: { latitude, longitude, altitude } }) => {
          const latlng = [latitude, longitude]
          if (!this.userCircle) {
            this.userCircle = L.circle(latlng, { radius: 20, color: '#094575', weight: 1, fillColor: '#094575', fillOpacity: 0.15 }).addTo(this.map)
            this.map.setView(latlng, 18)
          } else { this.userCircle.setLatLng(latlng) }
          this.detecterEtageParAltitude(altitude)
        },
        err => console.warn('Géolocalisation refusée :', err.message),
        { enableHighAccuracy: true }
      )

      if (window.RelativeAltitudeSensor) {
        try {
          const sensor = new RelativeAltitudeSensor({ frequency: 1 })
          sensor.addEventListener('reading', () => { this.detecterEtageParAltitude(170 + sensor.relativeAltitude) })
          sensor.addEventListener('error', e => console.warn('Sensor :', e.error))
          Promise.all([
            navigator.permissions.query({ name: 'accelerometer' }),
            navigator.permissions.query({ name: 'gyroscope' })
          ]).then(results => { if (results.every(r => r.state === 'granted')) sensor.start() })
        } catch (e) { console.warn('RelativeAltitudeSensor :', e) }
      }

      L.control.scale().addTo(this.map)
      this.chargerEtage(0)
      this.chargerStands()
    },
  },

  mounted() { this.createMap() }
}
</script>

<template>
  <div id="mapContenant"></div>

  <!-- Floor panel -->
  <div v-if="showFloorPanel" class="floor-panel">
    <div class="panel-header">
      <span class="panel-title-white">Hall</span>
      <span class="altitude-badge" v-if="altitudeActuelle !== null">{{ altitudeActuelle }} m</span>
      <button class="close-btn-white" @click="showFloorPanel = false">✕</button>
    </div>
    <div class="floor-buttons">
      <button v-for="i in [2,1,0]" :key="i" :class="{ active: currentFloor === i }" @click="setFloor(i)">
        {{ floors[i].label }}
      </button>
    </div>
    <div class="auto-row">
      <span :class="['auto-badge', autoFloor ? 'on' : 'off']">{{ autoFloor ? 'Auto' : 'Manual' }}</span>
      <button v-if="!autoFloor" class="repasser-auto" @click="repasserAuto">↺ Auto</button>
    </div>
  </div>
  <button v-if="!showFloorPanel" class="reopen-floor-btn" @click="showFloorPanel = true" title="Change hall">🏢</button>

  <!-- Layer panel -->
  <transition name="slide-up">
    <div v-if="showLayerPanel" class="layer-panel">
      <div class="panel-header">
        <span class="panel-title-dark">Layers</span>
        <button class="close-btn-dark" @click="showLayerPanel = false">✕</button>
      </div>
      <div class="layer-row" @click="toggleLayer('top50')">
        <span class="layer-dot" style="background:#094575"></span>
        <span class="layer-label">Top 50</span>
        <span class="layer-toggle" :class="{ on: layerVisible.top50 }">{{ layerVisible.top50 ? '●' : '○' }}</span>
      </div>
      <div class="layer-row" @click="toggleLayer('imagerie')">
        <span class="layer-dot" style="background:#2d6fa8"></span>
        <span class="layer-label">Satellite imagery</span>
        <span class="layer-toggle" :class="{ on: layerVisible.imagerie }">{{ layerVisible.imagerie ? '●' : '○' }}</span>
      </div>
      <div class="layer-row" @click="toggleLayer('recharge')">
        <span class="layer-dot" style="background:#7a9fbf"></span>
        <span class="layer-label">EV charging</span>
        <span class="layer-toggle" :class="{ on: layerVisible.recharge }">{{ layerVisible.recharge ? '●' : '○' }}</span>
      </div>
      <div class="layer-row" @click="toggleLayer('collegue')">
        <span class="layer-dot" style="background:#a8bfce"></span>
        <span class="layer-label">Colleague picks ⭐</span>
        <span class="layer-toggle" :class="{ on: layerVisible.collegue }">{{ layerVisible.collegue ? '●' : '○' }}</span>
      </div>
      <div class="layer-row" @click="toggleLayer('itineraire')">
        <span class="layer-dot" style="background:#d0dde6"></span>
        <span class="layer-label">HR itinerary</span>
        <span class="layer-toggle" :class="{ on: layerVisible.itineraire }">{{ layerVisible.itineraire ? '●' : '○' }}</span>
      </div>
    </div>
  </transition>
</template>

<style scoped>
#mapContenant { width: 100%; height: 100vh; }

/* ── Labels texte fixes sur polygones ── */
.label-stand-fixe {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  font-family: 'Arial', sans-serif;
  font-size: 0.6rem;
  font-weight: 300;
  color: #094575;
  white-space: nowrap;
  pointer-events: none;
}
.label-stand-fixe::before { display: none; }

.label-jcd {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  font-family: 'Arial Black', 'Arial', sans-serif;
  font-size: 0.65rem;
  font-weight: 900;
  color: white;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
.label-jcd::before { display: none; }
</style>

<style>
/* ── Popups ── */
.popup-stand { font-family: sans-serif; max-width: 280px; }

.popup-multi-header {
  font-weight: 700; font-size: 0.78rem; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 10px; padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}
.popup-multi-item { padding: 4px 0; }
.popup-multi-sep  { border-bottom: 1px solid #f1f5f9; margin-bottom: 8px; padding-bottom: 8px; }

.popup-single { font-family: sans-serif; }
.popup-photo {
  width: 100%; height: 110px; object-fit: cover;
  border-radius: 8px; margin-bottom: 8px; display: block;
}
.popup-photo-placeholder {
  width: 100%; height: 56px; background: #f0f4f8; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #94a3b8; font-size: 0.78rem; margin-bottom: 8px;
}
.popup-nom   { font-weight: 700; font-size: 0.95rem; color: #094575; margin-bottom: 2px; }
.popup-meta  { font-size: 0.72rem; color: #64748b; margin-bottom: 5px; }
.popup-pitch { font-size: 0.8rem; color: #334155; line-height: 1.4; margin-bottom: 7px; }
.popup-jours { display: flex; flex-wrap: wrap; gap: 4px; }
.popup-jour  { color: white; font-size: 0.67rem; font-weight: 700; padding: 2px 7px; border-radius: 20px; }

/* ── Points stands ── */
.stand-dot {
  width: 14px; height: 14px; border-radius: 50%;
  background: #094575;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.6), 0 0 8px 4px rgba(147,197,253,0.7);
  display: flex; align-items: center; justify-content: center;
}
.stand-dot-inner {
  width: 4px; height: 4px; border-radius: 50%;
  background: white; opacity: 0.9;
}

/* ── Panels ── */
.floor-panel {
  position: absolute; bottom: 100px; right: 16px; z-index: 1000;
  background: #094575; border: 1px solid rgba(255,255,255,0.3);
  border-radius: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  padding: 12px 14px; min-width: 150px;
}
.layer-panel {
  position: absolute; bottom: 100px; left: 16px; z-index: 1000;
  background: white; border: 1.5px solid #094575;
  border-radius: 16px; box-shadow: 0 6px 18px rgba(9,69,117,0.18);
  padding: 12px 14px; min-width: 210px;
}
.panel-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.panel-title-white { font-weight: 700; font-size: 0.9rem; color: white; flex: 1; }
.panel-title-dark  { font-weight: 700; font-size: 0.9rem; color: #094575; flex: 1; }
.close-btn-white { background: none; border: none; cursor: pointer; font-size: 0.85rem; color: rgba(255,255,255,0.6); padding: 0; }
.close-btn-dark  { background: none; border: none; cursor: pointer; font-size: 0.85rem; color: #94a3b8; padding: 0; }

.altitude-badge { background: rgba(255,255,255,0.15); color: white; border-radius: 8px; padding: 2px 8px; font-size: 0.78rem; font-weight: 600; }

.floor-buttons { display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; }
.floor-buttons button {
  padding: 7px 12px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.35);
  background: transparent; color: rgba(255,255,255,0.85);
  font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.18s; text-align: left;
}
.floor-buttons button.active { background: white; color: #094575; border-color: white; }

.auto-row { display: flex; align-items: center; gap: 8px; }
.auto-badge { font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
.auto-badge.on  { background: rgba(255,255,255,0.2); color: white; }
.auto-badge.off { background: white; color: #094575; }
.repasser-auto { font-size: 0.72rem; background: none; border: 1px solid rgba(255,255,255,0.5); color: white; border-radius: 8px; padding: 3px 8px; cursor: pointer; }

.reopen-floor-btn {
  position: absolute; bottom: 100px; right: 16px; z-index: 1000;
  background: #094575; border: 1px solid rgba(255,255,255,0.3); border-radius: 12px;
  font-size: 1.3rem; width: 44px; height: 44px; cursor: pointer; box-shadow: 0 3px 10px rgba(0,0,0,0.2);
}

.layer-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 2px; border-bottom: 1px solid #f1f5f9; cursor: pointer; user-select: none;
}
.layer-row:last-child { border-bottom: none; }
.layer-dot   { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.layer-label { flex: 1; font-size: 0.86rem; color: #334155; font-weight: 500; }
.layer-toggle { font-size: 1.2rem; color: #cbd5e1; transition: color 0.2s; }
.layer-toggle.on { color: #094575; }

.slide-up-enter-active, .slide-up-leave-active { transition: opacity 0.2s, transform 0.2s; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(10px); }

/* ── Labels texte fixes sur polygones ── */
.label-stand-fixe {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  font-family: 'Arial', sans-serif;
  font-size: 0.6rem;
  font-weight: 300;
  color: #094575;
  white-space: nowrap;
  pointer-events: none;
}
.label-stand-fixe::before { display: none; }

.label-jcd {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  font-family: 'Arial Black', 'Arial', sans-serif;
  font-size: 0.65rem;
  font-weight: 900;
  color: white;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
.label-jcd::before { display: none; }
</style>


<!-- <script setup>
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import markerIcon from '/marker3.png'
</script>

<script>
const FLOORS = [
  {label: "Rez-de-chaussée", file: "/maps/floor_0.geojson", altMin: 170,    altMax: 173.8},
  {label: "1er étage",       file: "/maps/floor_1.geojson", altMin: 173.80, altMax: 179},
  {label: "2ème étage",      file: "/maps/floor_2.geojson", altMin: 179,    altMax: 185},
]

// Ordre d'affichage : 2ème étage en haut, RDC en bas
const DISPLAY_ORDER = [2, 1, 0]

export default {
  expose: ['zoomSurCommune', 'toggleCouches'],

  data() {
    return {
      maps: [],
      geoJsonLayers: [],
      userMarkers: [],
      iconGeoloc: null,
      altitudeActuelle: null,
      floors: FLOORS,
      expandedFloor: null,  // index de l'étage agrandi, null = égal
    }
  },

  methods: {
    // Agrandit une carte ou revient à l'état égal si déjà agrandie
    toggleExpand(floorIndex) {
      this.expandedFloor = this.expandedFloor === floorIndex ? null : floorIndex
      // Leaflet doit recalculer sa taille après le changement de hauteur
      this.$nextTick(() => {
        this.maps.forEach(map => map && map.invalidateSize())
      })
    },

    chargerEtage(index) {
      const map = this.maps[index]
      if (!map) return

      if (this.geoJsonLayers[index]) {
        map.removeLayer(this.geoJsonLayers[index])
        this.geoJsonLayers[index] = null
      }

      fetch(FLOORS[index].file)
        .then(res => res.json())
        .then(data => {
          const layer = L.geoJSON(data, {
            style: {
              color: "#094575",
              weight: 1.5,
              fillColor: "#ffffff",
              fillOpacity: 0.5,
            },
            onEachFeature: (feature, layer) => {
              if (feature.properties?.name) {
                layer.bindTooltip(feature.properties.name)
              }
            }
          }).addTo(map)

          this.geoJsonLayers[index] = layer
          map.fitBounds(layer.getBounds())
        })
        .catch(err => console.error(`Erreur chargement plan étage ${index} :`, err))
    },

    mettreAJourPosition(lat, lng) {
      this.maps.forEach((map, i) => {
        if (!map) return
        if (!this.userMarkers[i]) {
          this.userMarkers[i] = L.marker([lat, lng], { icon: this.iconGeoloc })
            .bindPopup("<b>Vous êtes ici</b>")
            .addTo(map)
        } else {
          this.userMarkers[i].setLatLng([lat, lng])
        }
      })
    },

    createMaps() {
      this.iconGeoloc = L.icon({ iconUrl: markerIcon, iconSize: [28, 42] })

      DISPLAY_ORDER.forEach((floorIndex, position) => {
        const containerId = `map-floor-${floorIndex}`
        const map = L.map(containerId, { zoomControl: position === 0 }).setView([48.00, 2.34], 18)

        L.tileLayer(
          'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}',
          {
            minZoom: 0,
            maxZoom: 20,
            attribution: position === 2
              ? '&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              : '',
            ext: 'png'
          }
        ).addTo(map)

        // Label d'étage en haut à droite
        const labelControl = L.control({ position: 'topright' })
        labelControl.onAdd = () => {
          const div = L.DomUtil.create('div', 'floor-label-control')
          div.innerHTML = FLOORS[floorIndex].label
          return div
        }
        labelControl.addTo(map)

        if (position === 0) {
          L.control.scale().addTo(map)
        }

        this.maps[floorIndex] = map
        this.chargerEtage(floorIndex)
      })

      navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, altitude } = position.coords
          if (altitude !== null) {
            this.altitudeActuelle = Math.round(altitude * 10) / 10
          }
          this.mettreAJourPosition(latitude, longitude)
        },
        (err) => console.warn("Géolocalisation refusée :", err.message),
        { enableHighAccuracy: true }
      )
    },

    zoomSurCommune(lat, lng) {
      this.maps.forEach(map => map && map.setView([lat, lng], 18))
    },

    toggleCouches() {}
  },

  mounted() {
    this.createMaps()
  }
}
</script> -->

<!-- <template>
  <div class="maps-container">

    <!-- 2ème étage -->
    <!-- <div
      class="map-wrapper"
      :class="{
        expanded:  expandedFloor === 2,
        collapsed: expandedFloor !== null && expandedFloor !== 2
      }"
    >
      <div id="map-floor-2"></div>
      <button class="expand-btn" @click="toggleExpand(2)">
        <span class="material-symbols-outlined">
          {{ expandedFloor === 2 ? 'expand_less' : 'expand_more' }}
        </span>
      </button>
    </div>

    <div class="map-divider"></div>

    <!-- 1er étage -->
    <!-- <div
      class="map-wrapper"
      :class="{
        expanded:  expandedFloor === 1,
        collapsed: expandedFloor !== null && expandedFloor !== 1
      }"
    > -->
      <!-- <div id="map-floor-1"></div>
      <button class="expand-btn" @click="toggleExpand(1)">
        <span class="material-symbols-outlined">
          {{ expandedFloor === 1 ? 'expand_less' : 'expand_more' }}
        </span>
      </button>
    </div> -->

   <!--  <div class="map-divider"></div> -->

    <!-- RDC -->
   <!--  <div
      class="map-wrapper"
      :class="{
        expanded:  expandedFloor === 0,
        collapsed: expandedFloor !== null && expandedFloor !== 0
      }"
    > -->
      <!-- <div id="map-floor-0"></div>
      <button class="expand-btn" @click="toggleExpand(0)">
        <span class="material-symbols-outlined">
          {{ expandedFloor === 0 ? 'expand_less' : 'expand_more' }}
        </span>
      </button>
    </div> -->

  <!-- </div>
</template> -->

<!-- <style scoped>
.maps-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* État par défaut : chaque carte prend 1/3 */
.map-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  transition: flex 0.3s ease;
}

/* Carte agrandie : prend tout l'espace */
.map-wrapper.expanded {
  flex: 6;
}

/* Cartes réduites : hauteur minimale juste pour voir le label */
.map-wrapper.collapsed {
  flex: 0;
  min-height: 36px;
}

.map-wrapper > div:first-child {
  width: 100%;
  height: 100%;
  background: #f0f4f8;
}

/* Bouton agrandir/réduire en bas à gauche de chaque carte */
.expand-btn {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 1000;
  background: #094575;
  border: 1px solid white;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.expand-btn:hover {
  background: rgba(9, 69, 117, 0.8);
}

.expand-btn .material-symbols-outlined {
  font-size: 1.2rem;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.map-divider {
  background: #094575;
  height: 3px;
  flex-shrink: 0;
}
</style>

<style>
.floor-label-control {
  background: #094575;
  color: white;
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.8rem;
  border: 1px solid white;
  pointer-events: none;
}
</style> -->