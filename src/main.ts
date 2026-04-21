import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { syncAppViewportHeight } from './lib/viewport'

syncAppViewportHeight()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
