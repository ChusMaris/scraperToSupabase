# BasquetCatala JSON Scraper & Supabase Uploader

Esta es la aplicación unificada para extraer datos de partidos de baloncesto de la web de BasquetCatala y subirlos directamente a una base de datos Supabase.

## 🚀 Cómo empezar

### 1. Requisitos previos
- Tener una cuenta en **Supabase**.
- Crear las tablas necesarias en Supabase (Categorías, Temporadas, Competiciones, Partidos, Jugadores, Movimientos).

### 2. Configuración de Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto (o configúralo en tu servicio de despliegue) con las siguientes variables:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

### 3. Instalación
```bash
npm install
```

### 4. Desarrollo
Para ejecutar la aplicación en modo desarrollo con el servidor proxy (necesario para saltar CORS):
```bash
npm run dev
```

### 5. Construcción para Producción
```bash
npm run build
```

---

## ⚠️ Nota sobre GitHub Pages

Si planeas desplegar esta aplicación en **GitHub Pages**:

1.  **El servidor proxy no funcionará:** GitHub Pages solo sirve archivos estáticos. El archivo `server.ts` (Express) no se ejecutará.
2.  **Solución:** Para que la extracción funcione desde el navegador sin el servidor proxy, tendrías que:
    -   Usar una extensión de navegador para saltar CORS.
    -   O desplegar la aplicación en un servicio que admita Node.js (como **Vercel**, **Render**, **Railway** o **Heroku**).
3.  **Configuración de Vite:** En `vite.config.ts`, asegúrate de añadir `base: './'` o `base: '/nombre-de-tu-repo/'` dentro del objeto de configuración para que las rutas de los archivos funcionen correctamente en GitHub Pages.

---

## 🛠 Estructura del Proyecto

- `src/App.tsx`: Componente principal de la interfaz.
- `src/components/`: Componentes visuales (`JobCard`, `Icon`).
- `src/services/`: Lógica de scraping (`scraperService`) y base de datos (`supabaseService`).
- `src/lib/`: Configuración del cliente de Supabase.
- `server.ts`: Servidor Express que actúa como proxy para las peticiones a las APIs externas.
