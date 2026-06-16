<script setup>
import Map from '../components/MapComponent.vue'
import { ref, onMounted } from 'vue'
import FooterComponent from '../components/FooterComponent.vue'

const mapRef      = ref(null)
const query       = ref('')
const suggestions = ref([])
const showSugg    = ref(false)
const allStands   = ref([])

onMounted(async () => {
  const res  = await fetch('/stands.json')
  const data = await res.json()
  allStands.value = [
    ...data.top50.map(s    => ({ ...s, categorie: 'top50'    })),
    ...data.imagerie.map(s => ({ ...s, categorie: 'imagerie' })),
    ...data.recharge.map(s => ({ ...s, categorie: 'recharge' })),
  ]
})

function fetchSuggestions() {
  const q = query.value.trim().toLowerCase()
  if (q.length < 2) { suggestions.value = []; return }
  suggestions.value = allStands.value.filter(s =>
    s.nom.toLowerCase().includes(q) ||
    s.stand_id.toLowerCase().includes(q) ||
    (s.espace || '').toLowerCase().includes(q)
  ).slice(0, 8)
  showSugg.value = true
}

const CATEGORIE_LABEL = {
  top50:     { label: 'Top 50',    color: '#e91e8c' },
  imagerie:  { label: 'Satellite', color: '#7c3aed' },
  recharge:  { label: 'Charging',  color: '#10b981' },
}

function selectionnerStand(stand) {
  query.value    = stand.nom
  showSugg.value = false
  mapRef.value?.zoomSurStand(stand)
}

function onSubmit(e) {
  e.preventDefault()
  if (suggestions.value.length > 0) selectionnerStand(suggestions.value[0])
}
</script>

<template>
  <header>
    <h1>VivaTech : les pépites par JCD</h1>
    <form @submit.prevent="onSubmit">

      <button type="button" class="couche-btn" @click="mapRef?.toggleCouches()" title="Layers">
        <img src="/couche.png" style="width:20px;height:20px;" alt="layers" />
      </button>

      <div class="autocomplete-wrapper">
        <input
          placeholder="Search a booth…"
          type="text"
          v-model="query"
          @input="fetchSuggestions"
          @blur="setTimeout(() => showSugg = false, 150)"
          autocomplete="off"
        />
        <ul v-if="showSugg && suggestions.length" class="suggestions-list">
          <li v-for="(s, i) in suggestions" :key="i" @mousedown="selectionnerStand(s)">
            <span class="sug-nom">{{ s.nom }}</span>
            <span class="sug-tag" :style="{ background: CATEGORIE_LABEL[s.categorie]?.color }">
              {{ CATEGORIE_LABEL[s.categorie]?.label }}
            </span>
          </li>
        </ul>
        <div v-if="showSugg && query.length >= 2 && suggestions.length === 0" class="no-result">
          No booth found
        </div>
      </div>

      <button type="submit">Go</button>
    </form>
  </header>

  <Map ref="mapRef" @click="showSugg = false" />
  <FooterComponent style="position:absolute;bottom:0;left:0;right:0;z-index:1000;" />
</template>

<style scoped>
header {
  z-index: 1000; position: absolute;
  top: 0; left: 0; right: 0; background: #094575;
}
h1 {
  font-family: 'Arial Black', sans-serif; text-align: center;
  font-size: 2rem; padding: 0.5rem; color: white; margin: 0;
}
form {
  display: flex; align-items: center; justify-content: center;
  gap: 6px; max-width: 600px; margin: 0 auto;
  padding: 0.4rem 1rem 0.6rem;
}
.autocomplete-wrapper { position: relative; flex: 1; }

form input {
  width: 100%; padding: 7px 10px; font-size: 1rem;
  border-radius: 8px; border: 2px solid white; outline: none;
  box-sizing: border-box; background: rgba(255,255,255,0.1); color: white;
}
form input::placeholder { color: rgba(255,255,255,0.6); }

.couche-btn {
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.4);
  border-radius: 8px; padding: 6px 8px; cursor: pointer;
  display: flex; align-items: center; flex-shrink: 0;
}
.couche-btn:hover { background: rgba(255,255,255,0.25); }

form button[type="submit"] {
  padding: 7px 16px; font-size: 0.95rem; border-radius: 8px;
  background: white; color: #094575; border: none; cursor: pointer;
  font-weight: 700; flex-shrink: 0;
}

.suggestions-list {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: white; border: 2px solid #094575; border-radius: 10px;
  list-style: none; margin: 0; padding: 0; z-index: 2000;
  max-height: 240px; overflow-y: auto;
  box-shadow: 0 4px 12px rgba(9,69,117,0.15);
}
.suggestions-list li {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;
}
.suggestions-list li:last-child { border-bottom: none; }
.suggestions-list li:hover { background: #f0f7ff; }

.sug-nom { font-weight: 600; color: #094575; font-size: 0.9rem; flex: 1; }
.sug-tag {
  font-size: 0.68rem; font-weight: 700; color: white;
  padding: 2px 7px; border-radius: 20px; flex-shrink: 0; margin-left: 8px;
}

.no-result {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: white; border: 2px solid #094575; border-radius: 10px;
  padding: 10px 14px; color: #94a3b8; font-size: 0.88rem; z-index: 2000;
}

@media (max-width: 600px) {
  h1 { font-size: 1.3rem; white-space: nowrap; }
  form { padding: 0.3rem 0.6rem 0.5rem; gap: 4px; }
}
</style>


<!-- <script setup>
import Map from '../components/MapComponent.vue'
import { ref } from 'vue'
import FooterComponent from '../components/FooterComponent.vue'

const ville = ref('')
const mapRef = ref(null)
const suggestions = ref([])
const showSuggestions = ref(false)
const showSearch = ref(false)  // contrôle l'ouverture de la barre

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (!showSearch.value) {
    ville.value = ''
    suggestions.value = []
    showSuggestions.value = false
  }
}

async function fetchSuggestions() {
  if (ville.value.length < 2) {
    suggestions.value = []
    return
  }
  const geocode = "https://data.geopf.fr/geocodage/search?q=" + ville.value + "&limit=5"
  const res = await fetch(geocode)
  const data = await res.json()
  suggestions.value = data.features.map(f => ({
    label: f.properties.label,
    coords: f.geometry.coordinates
  }))
  showSuggestions.value = true
}

function selectionnerVille(suggestion) {
  ville.value = suggestion.label
  showSuggestions.value = false
  const [lng, lat] = suggestion.coords
  mapRef.value.zoomSurCommune(lat, lng)
}

function rechercheVille(e) {
  e.preventDefault()
  if (!ville.value) return
  const geocode = "https://data.geopf.fr/geocodage/search?q=" + ville.value
  fetch(geocode)
    .then(res => res.json())
    .then(result => {
      const coords = result.features[0].geometry.coordinates.reverse()
      mapRef.value.zoomSurCommune(coords[0], coords[1])
      showSuggestions.value = false
    })
}
</script>  -->

<!-- <template>
  <div class="page-wrapper">
    <header>

      <!-- Barre titre : icône search | h1 | vide (symétrie) -->
      <!-- <div class="header-bar"> -->
        <!-- <button
          class="icon-btn"
          :class="{ active: showSearch }"
          @click="toggleSearch"
          aria-label="Rechercher"
        >
          <span class="material-symbols-outlined">search</span>
        </button> -->

        <!-- <h1>VivaTech par JCD</h1> -->

        <!-- Espace symétrique à droite pour centrer le titre -->
       <!--  <div class="icon-placeholder"></div>
      </div> -->

      <!-- Barre de recherche dépliable -->
      <!-- <div class="search-drawer" :class="{ open: showSearch }"> -->
        <!-- <form @submit.prevent="rechercheVille">
          <div class="autocomplete-wrapper">
            <input
              placeholder="Taper un nom d'enseigne"
              type="text"
              v-model="ville"
              @input="fetchSuggestions"
              @blur="setTimeout(() => showSuggestions = false, 150)"
            />
            <ul v-if="showSuggestions && suggestions.length" class="suggestions-list">
              <li
                v-for="(s, i) in suggestions"
                :key="i"
                @mousedown="selectionnerVille(s)"
              >
                {{ s.label }}
              </li>
            </ul>
          </div>
          <!-- <button type="submit">Go</button> -->
        <!-- </form> -->
      <!-- </div> -->

    <!-- </header> -->

    <!-- <div class="map-zone">
      <Map ref="mapRef" @click="showSuggestions = false" />
    </div> -->

    <!-- <FooterComponent style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 1000;" />
  </div>
</template> -->

<!-- <style scoped>
/* ── Structure globale ── */
.page-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

header {
  flex-shrink: 0;
  z-index: 1000;
  background: #094575;
}

.map-zone {
  flex: 1;
  min-height: 0;
  position: relative;
}

/* ── Ligne header : icône | titre | placeholder ── */
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.8rem;
}

h1 {
  font-family: 'Arial Black', sans-serif;
  font-size: 1.5rem;
  color: white;
  margin: 0;
  flex: 1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Bouton icône ── */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
  padding: 0;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.icon-btn .material-symbols-outlined {
  font-size: 1.8rem;
  color: white;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  transition: font-variation-settings 0.15s;
}

/* Icône remplie quand la barre est ouverte */
.icon-btn.active .material-symbols-outlined {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Icône map remplie quand on est sur la page */
.router-link-active .material-symbols-outlined {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Supprime le soulignement et la couleur par défaut des liens */
a.icon-btn {
  text-decoration: none;
  color: inherit;
}

/* ── Barre de recherche dépliable ── */
.search-drawer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  padding: 0 1rem;
}

.search-drawer.open {
  max-height: 100px;
  padding: 0 1rem 0.6rem;
}

form {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.autocomplete-wrapper {
  position: relative;
  flex: 1;
  max-width: 480px;
}

form input {
  width: 100%;
  padding: 6px 10px;
  font-size: 1rem;
  border-radius: 8px;
  border: 2px solid white;
  outline: none;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.12);
  color: white;
}

form input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

form button[type="submit"] {
  padding: 6px 14px;
  font-size: 1rem;
  border-radius: 8px;
  background: white;
  color: #094575;
  border: none;
  cursor: pointer;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Suggestions ── */
.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #094575;
  border-radius: 10px;
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  z-index: 2000;
  max-height: 150px;
  overflow-y: auto;
  text-align: left;
}

.suggestions-list li {
  padding: 8px 12px;
  cursor: pointer;
  color: #094575;
  font-weight: 600;
}

.suggestions-list li:hover {
  background-color: #f1bddd;
}

/* Espace vide pour centrer le titre */
.icon-placeholder {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}
@media (max-width: 600px) {
  h1 {
    font-size: 1.1rem;
  }
}
</style> -->