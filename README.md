# BasquetCatala JSON Scraper & Supabase Uploader

Esta app extrae datos de partidos de baloncesto de BasquetCatala y puede subirlos a Supabase desde el propio navegador.

## 🚀 Cómo empezar

### 1. Requisitos previos
- Tener una cuenta en Supabase.
- Crear las tablas necesarias en Supabase para categorías, temporadas, competiciones, partidos, jugadores y movimientos.

### 2. Configuración de variables de entorno
Crea un archivo `.env` en la raíz del proyecto con:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

### 3. Instalar dependencias
```bash
npm install
```

### 4. Desarrollo local
```bash
npm run dev
```

### 5. Construcción para producción
```bash
npm run build
```

## 🌐 GitHub Pages
La app está preparada para desplegarse en GitHub Pages sin necesidad de un backend propio.

- El frontend se publica con `gh-pages`.
- La extracción funciona desde el navegador usando proxies compatibles con GitHub Pages.
- No hace falta tener un servidor de API ni un backend adicional.

Para publicar:
```bash
npm run deploy
```

## 🛠 Estructura del proyecto

- `src/App.tsx`: componente principal de la interfaz.
- `src/components/`: componentes visuales (`JobCard`, `Icon`).
- `src/services/`: lógica de scraping y subida a Supabase.
- `src/lib/`: configuración del cliente de Supabase.
- `server.ts`: servidor de desarrollo opcional para Vite.

## 📄 Documentación adicional

- [ARCHITECTURE.md](ARCHITECTURE.md): documentación técnica del proyecto.
