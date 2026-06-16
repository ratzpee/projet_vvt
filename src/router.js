import { createWebHistory, createRouter } from 'vue-router'
import home from './views/HomeView.vue'
const routes = [
    { path: '/', name: 'carte', component: home },
]
const router = createRouter({ history: createWebHistory(), routes })
export default router