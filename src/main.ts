import './ui/style.css';
import { App } from './ui/app.ts';

const view = document.getElementById('view')!;
const ui = document.getElementById('ui')!;
const app = new App(view, ui);
(window as unknown as { app: App }).app = app;
