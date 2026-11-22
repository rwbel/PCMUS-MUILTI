/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * main.tsx - Punto de entrada de la aplicación React
 *
 * Renderiza el componente App en el elemento DOM con id "root"
 * y aplica los estilos globales de index.css.
 * Es el archivo que Vite usa como entry point para construir la app.
 */

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
