# C-Stream SaaS · Entrega 3.3: catálogo + paneles + asistente Lu

Esta entrega trae la base de datos completa y el catálogo público con el diseño nuevo.
Tu catálogo C-Stream viene cargado como primer dueño, para que lo veas funcionando de inmediato.

| Qué | Dónde |
| --- | --- |
| Base de datos (tablas, seguridad, imágenes, funciones de superadmin) | `supabase/01_schema.sql` |
| Biblioteca de plataformas (30, con logos y descripciones base) | `supabase/02_library.sql` |
| Tu catálogo C-Stream (24 plataformas (CapCut Pro oculta), 56 precios, 9 combos, 5 pagos, 2 avisos) | `supabase/03_seed_cstream.sql` |
| Catálogo público en React | `src/` → se abre en `/c/cstream` |
| Logos de la biblioteca (WebP, 488 KB en total) | `public/library/` |
| Tu logo, QR y la imagen de Cineplanet | `public/demo/cstream/` |

---

## Paso 1 · Probarlo en tu PC (sin Supabase)

Sin configurar nada, el catálogo funciona en **modo demo** con tus datos de C-Stream.

```powershell
cd ruta\a\cstream-saas
npm install
npm run dev
```

Abre **http://localhost:5173/c/cstream**.

Prueba agregar al carrito, cambiar entre Perfil 1 mes, 3 meses y Cuenta completa, el tema oscuro y los avisos.
Para ver otra vez el popup de avisos, abre una ventana de incógnito.

---

## ¿Ya tienes instalada una entrega anterior? Actualiza así

1. Reemplaza tu carpeta por esta. Conserva tu archivo `.env` y ejecuta `npm install`.
2. En Supabase → **SQL Editor**, ejecuta **en este orden**:
   1. `supabase/05_entrega_2.sql`: agrega las columnas nuevas.
   2. `supabase/01_schema.sql` completo: actualiza funciones, permisos y seguridad. Se puede volver a ejecutar sin perder datos.
   3. `supabase/03_seed_cstream.sql`: deja tu catálogo C-Stream con los datos de esta entrega. Ojo: borra los cambios que hayas hecho a mano en C-Stream.
3. Si es una instalación nueva, sigue el Paso 2 y no necesitas el `05`.

---

## Entrar a los paneles

1. Hay una sola puerta para todos: `http://localhost:5173/entrar` (en Vercel: `https://tu-sitio.vercel.app/entrar`). Los proveedores nuevos se registran en `/registro`. El cliente final no necesita cuenta.
2. Cada cuenta va a su panel:
   - **Dueño** → `/panel`, solo su catálogo.
   - **Superadmin** → `/admin`, tu panel propio.

**Tu panel de superadmin (`/admin`):**
- **Resumen:** catálogos activos, cuáles vencen en 7 días, cuáles están vencidos y cuánto cobraste este mes. Para los que vencen, un botón **Avisar** abre WhatsApp con tu mensaje de renovación.
- **Catálogos:** buscar y filtrar (al día, por vencer, vencidos, suspendidos). En **Gestionar** tienes:
  - **Días y pagos:** sumar días por plan (mensual 30, trimestral 90, semestral 180, anual 365), reiniciar desde hoy, restar días o poner una fecha exacta. Cada movimiento registra el monto y una nota. Aquí también suspendes o reactivas.
  - **Datos:** nombre, contacto, teléfono, notas privadas y la firma "hecho con C-Stream".
  - **Acceso:** vincular o desvincular la cuenta del dueño, copiar el enlace y borrar el catálogo (pide escribir el slug).
  - **Historial:** todos los movimientos.
  - **Editar su catálogo:** entras a su panel de dueño para ayudarlo, y regresas con **Volver a mi panel**.
- **Nuevo catálogo:** nombre, enlace automático, plan, días, monto, contacto y el correo del dueño (si su cuenta ya existe, se vincula de una vez).
- **Ajustes:** tu mensaje de renovación, con vista previa.

**Cómo entra un proveedor nuevo:**
1. Se registra en `/registro` con su nombre, negocio, WhatsApp, correo y contraseña. Su cuenta queda **en revisión**: no ve ningún catálogo.
2. Te aparece en `/admin` como **Solicitud nueva**. Tocas **Activar**: se abre "Nuevo catálogo" con sus datos ya puestos y, al crearlo, queda vinculado.
3. Él vuelve a entrar en `/entrar` y ya ve su panel.

Si no quieres que confirme su correo antes de entrar: Supabase → Authentication → Sign In / Providers → Email → apaga **Confirm email**. Si lo dejas encendido, le llega un correo de confirmación primero.
En **Authentication → URL Configuration** agrega `https://tu-sitio.vercel.app/entrar` y `https://tu-sitio.vercel.app/clave` en Redirect URLs.
3. Para que funcione "¿Olvidaste tu contraseña?": en Supabase → **Authentication → URL Configuration**, pon tu dominio en **Site URL** y agrega `https://tu-sitio.vercel.app/panel/clave` en **Redirect URLs**.

**Qué hay en el panel:**
- **Inicio:** enlace del catálogo, cuántos días le quedan al plan, botón para renovar y una lista de lo que falta configurar.
- **Marca y contacto:** logo, color (con contraste garantizado), estilo de tarjetas, redondeo, tema, tipografías para títulos, tarjetas y texto, y los datos de atención. A la derecha hay una vista previa en vivo del catálogo real, en celular o escritorio.
- **Plataformas y precios:**
  - Agregas plataformas desde la biblioteca con buscador. Logo, descripción, características y restricciones se completan solos.
  - También puedes crear una desde cero con tu imagen.
  - Al escribir características te sugiere textos de otras plataformas (autocompletado).
  - Hay una **tabla de precios** para editarlos todos de una vez.
  - Puedes duplicar, ocultar, reordenar y agregar secciones como pasos, notas o imágenes.
- **Orden con números:** el número indica la posición (el 1 aparece primero). Tócalo para elegir otra posición, o mantenlo presionado y arrástralo sobre otra fila: las dos se intercambian y el resto no se mueve.
- **Menú contraíble y modo oscuro:** el botón arriba del menú lo reduce a íconos; el de la luna cambia el tema del panel.
- **Duraciones y categorías:** "Perfil · 1 mes", "Cuenta completa · 1 mes", etc.; cuál se abre primero; y los filtros.
- **Combos:** eliges las plataformas y el precio. Te muestra cuánto ahorra el cliente y te avisa si el combo sale más caro que comprar por separado.
- **Descuentos:** un interruptor (apagado por defecto), las reglas y qué categorías cuentan.
- **Métodos de pago:** QR, número para copiar, titular, nota y pasos.
- **Avisos:** imagen, tipo, botón (abrir una plataforma, WhatsApp o una sección), fechas de inicio y fin, y si sale como ventana.
- **Textos y ayuda:** preguntas frecuentes, garantía y condiciones, "Así compras", los textos de los íconos (i) y la plantilla del mensaje de WhatsApp con vista previa.
- **Asistente:** nombre, tono, saludo, foto y respuestas propias. Queda guardado para cuando se encienda en la Entrega 3.

**Seguridad y comportamiento:**
- Las imágenes se convierten a WebP en el navegador y se suben a la carpeta del dueño. Ningún dueño puede tocar la carpeta de otro.
- Si el plan vence, el panel queda en solo lectura con un botón para renovar. Nada se pierde.
- El dueño no puede ver tus notas, montos ni datos de contacto del catálogo. Tampoco puede cambiar sus días ni la firma de C-Stream.
- La firma "Catálogo hecho con C-Stream" viene apagada en todos los catálogos. Para mostrarla en uno: `update tenants set show_credit = true where slug = 'el-slug';`

---

## Paso 2 · Crear la base de datos en Supabase

1. Entra a https://supabase.com y crea un proyecto nuevo (región: **South America (São Paulo)**, la más cercana a Perú).
2. Ve a **SQL Editor → New query**. Pega y ejecuta (**Run**) los tres archivos, **en este orden**:
   1. `supabase/01_schema.sql`
   2. `supabase/02_library.sql`
   3. `supabase/03_seed_cstream.sql`

   Los tres se pueden volver a ejecutar sin romper nada. Si ejecutas de nuevo `03`, tu catálogo C-Stream vuelve a sus datos originales.
3. Crea tus dos cuentas en **Authentication → Users → Add user → Create new user**, marcando **Auto Confirm User**:
   - **Tu cuenta de superadmin** (tu correo principal).
   - **Tu cuenta de dueño** (otro correo tuyo). Con ella entrarás al panel como lo haría un cliente que te alquila.
4. Vuelve al **SQL Editor** y ejecuta esto, cambiando los dos correos:

```sql
-- Tú como superadmin
update profiles set role = 'superadmin'
where email = 'TU_CORREO_PRINCIPAL@gmail.com';

-- Tu segunda cuenta como dueña del catálogo C-Stream
update profiles set role = 'owner', tenant_id = (select id from tenants where slug = 'cstream')
where email = 'TU_OTRO_CORREO@gmail.com';
```

> Los paneles de superadmin y de dueño llegan en las próximas entregas. Dejar las cuentas listas desde ya te ahorra un paso después.

---

## Paso 3 · Conectar el catálogo a Supabase

1. En Supabase ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key** (la pública; **nunca** uses la `service_role` en el navegador)
2. En la carpeta del proyecto, copia `.env.example` como `.env.local` y pega tus datos:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_SUPPORT_WHATSAPP=51904670421
```

3. Reinicia `npm run dev`. Ahora el catálogo lee de la base de datos.

Para comprobar que la sincronización funciona, ve a Supabase → **Table Editor → prices**, cambia un precio y recarga la página. El cambio se ve al instante, en cualquier dispositivo.

---

## Paso 4 · Subirlo a GitHub

Crea un repositorio **vacío** en GitHub (por ejemplo `cstream-saas`, privado). Luego, en PowerShell:

```powershell
cd ruta\a\cstream-saas
git init
git add .
git commit -m "Entrega 1: base de datos y catálogo"
git branch -M main
git remote add origin https://github.com/Estrada165/cstream-saas.git
git push -u origin main
```

`.env.local` no se sube: está en `.gitignore`.

---

## Paso 5 · Publicarlo en Vercel

No subas `node_modules`, `dist` ni `.env`: el `.gitignore` ya los excluye. Vercel instala todo por su cuenta. Sí sube `package-lock.json`.

1. En https://vercel.com, haz clic en **Add New → Project** e importa tu repositorio.
2. Vercel detecta Vite solo. Antes de **Deploy**, abre **Environment Variables** y agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPPORT_WHATSAPP` (tu número, para el botón "Renovar")
3. Haz clic en **Deploy**.
4. En Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `https://tu-proyecto.vercel.app`
   - **Redirect URLs:** `https://tu-proyecto.vercel.app/entrar` y `https://tu-proyecto.vercel.app/clave`

**Direcciones:**
- `https://tu-proyecto.vercel.app` abre el **ingreso**. Si ya iniciaste sesión, te lleva directo a tu panel (superadmin o proveedor).
- `https://tu-proyecto.vercel.app/registro` es para proveedores nuevos.
- `https://tu-proyecto.vercel.app/c/cstream` es el catálogo que ven los clientes. Cada proveedor comparte el suyo.

**App instalable:** el panel se puede instalar como app, en celular ("Agregar a pantalla de inicio") y en computadora (ícono de instalar en la barra de direcciones o el botón **Instalar app** del menú). Abre directo en el ingreso. El catálogo del cliente no se instala: se abre con su enlace.

Cada `git push` a `main` vuelve a publicar automáticamente. Las ramas que no son `main` generan una vista previa.

---

## Novedades de la Entrega 3.2

- **Barra animada de plataformas** en el catálogo, en lugar de los filtros por categoría. Avanza sola y despacio, y se detiene al pasar el mouse o tocarla. Al elegir una plataforma ves todas sus opciones (perfil 1 mes, 3 meses, cuenta completa…) y solo los combos que la incluyen. Con "Ver todas" o la ✕ vuelves al catálogo completo.
- **Catálogos nuevos ya armados:** al crear o activar un catálogo, se cargan apagadas todas las plataformas de la biblioteca (con su logo, textos y categoría), los bancos y billeteras (solo logo, sin QR ni datos) y 4 preguntas frecuentes base. El dueño solo enciende lo que vende y pone precios. Para catálogos que ya existían: `/admin` → Gestionar → Acceso → **Cargar sugeridos**.
- **Ventana de gestión más amplia**, con las pestañas siempre visibles (sin desplazar de lado).
- **WhatsApp desde Lu:** el mensaje incluye la pregunta que hizo el cliente, con los emojis correctos.

---

## Encender el asistente Lu (una sola vez)

Lu corre en una **función de servidor de Supabase**. La clave de Gemini se guarda cifrada y nunca llega al navegador, ni al dueño ni al cliente.

**1. Crea tu frase secreta** (sirve para cifrar las claves):
Supabase → **Edge Functions → Secrets** → *Add new secret*:
- Name: `LU_SECRET`
- Value: una frase larga que solo tú sepas, de 24 caracteres o más. Ejemplo: `mi-gato-come-pizza-los-martes-2026`.
- **No la cambies después**: si la cambias, las claves guardadas dejan de funcionar y tendrías que cargarlas de nuevo.

**2. Publica la función** (elige una forma):
- **Desde el navegador:** Edge Functions → *Deploy a new function* → *Via Editor* → nombre `lu` → borra el ejemplo, pega todo el contenido de `supabase/functions/lu/index.ts` → *Deploy function*.
- **Desde PowerShell:**
  ```powershell
  npx supabase login
  npx supabase functions deploy lu --project-ref TU_PROJECT_REF
  ```
  `TU_PROJECT_REF` es lo que va entre `https://` y `.supabase.co` en tu Project URL.

**3. Conecta un catálogo:**
1. Con el Gmail de ese catálogo, entra a https://aistudio.google.com → *Get API key* → *Create API key*.
2. En `/admin` → Catálogos → Gestionar → **Asistente IA**: pega la clave, pon el Gmail como referencia y presiona **Guardar**.
3. Presiona **Probar conexión**. Si responde "Lista para atender 👋", ya está.

En ese momento aparece el botón "Pregúntale a Lu" en el catálogo.

**Cómo cuida tu cuota gratis:**
- **Respuestas por día:** cuando el catálogo llega al límite, Lu manda al cliente a WhatsApp en vez de gastar más.
- **Mensajes por cliente al día:** una sola persona no puede agotar la cuota.
- **Modelo:** por defecto `gemini-3.5-flash-lite`, el más económico. Revisa el límite real de tu clave en AI Studio y deja "Respuestas por día" por debajo de ese número.
- Lu solo responde con los datos de tu catálogo: precios, combos, preguntas frecuentes y las respuestas que el dueño cargue en "Asistente". No inventa precios.

**Búsqueda en internet (películas y series):** si alguien pregunta dónde ver una película o serie, Lu busca en Google. Recomienda solo plataformas que vendes y avisa que es información de internet que puede variar en Perú, con las fuentes. Se activa o desactiva por catálogo en `/admin` → Asistente IA. Gasta algo más de cuota, por eso solo se usa en esas preguntas.

**Si la búsqueda en internet no está en tu plan:** el plan gratis de Gemini suele no incluir búsquedas en Google, o trae muy pocas. Lu lo detecta, pausa la búsqueda 30 minutos y responde igual con tu catálogo. "Probar conexión" te muestra si tu clave tiene búsqueda disponible.

**Imágenes en respuestas:** en el panel del dueño → Asistente → Respuestas, cada respuesta puede llevar una imagen (o reutilizar la de un aviso). Lu la muestra cuando la pregunta coincide (ejemplo: combos de Cineplanet).

**Ojo con el plan gratis de Gemini:** Google puede usar las conversaciones para mejorar sus modelos. Por eso Lu nunca pide contraseñas ni datos personales.

---

## Qué trae el catálogo

- **Tus duraciones, no fijas.** El selector se arma con las opciones que tenga cada dueño ("Perfil · 1 mes", "Perfil · 2 meses promo", "Cuenta completa · 1 mes"…). Si una plataforma no tiene precio en una opción, no aparece en ella.
- **Tres tipos de precio.** Por opción (lo normal), precio único (Google 2TB) y "Consultar" (Cineplanet), que abre WhatsApp con un mensaje listo.
- **Descuentos por cantidad, opcionales.** Vienen apagados. Si el dueño los activa (dúo, trío…), el catálogo muestra la regla y el carrito la aplica. Si no, el cliente paga la suma normal.
- **Combos con precio propio.** Cuadrícula en escritorio y carrusel en móvil. Muestran cuánto se ahorra y entran al carrito como un solo producto con sus plataformas.
- **Checkout por WhatsApp.**
  - Nombre del cliente, método de pago con QR ampliable y descargable, y número con botón de copiar.
  - Vista previa del mensaje con emojis, que se edita desde la plantilla del dueño.
- **Avisos.**
  - Campana animada con contador de no leídos y popup en carrusel la primera vez de cada visita.
  - Las imágenes nunca se recortan: se ven completas sobre su propio fondo desenfocado.
  - Cada aviso tiene fecha de inicio y de fin.
- **Ayuda (i) para el cliente.** Ícono pequeño en plan, entrega, garantía, combos y pagos. Al tocarlo abre una burbuja corta. Los textos tienen un valor por defecto y el dueño podrá cambiarlos.
- **Diseño.**
  - El logo aparece una sola vez: en el inicio. La barra superior lo muestra al bajar.
  - Entrega, garantía y WhatsApp en tarjetas; aviso destacado bajo el buscador.
  - "Cómo comprar" con íconos y dos botones: empezar a elegir o pedir ayuda.
  - Pie de página con llamado a WhatsApp, secciones, atención y métodos de pago.
  - Botones tipo tecla que se hunden al presionar.
  - Avión de papel que vuela al carrito.
  - Cambio de tema con un círculo que se expande.
  - Barra flotante del carrito en móvil.
- **Color de cada dueño.**
  - Elige un solo color y el sistema deriva el resto, con contraste legible garantizado en claro y oscuro. Probado con 8 colores, incluidos amarillo pálido, negro y blanco.
  - Si el color elegido no permite leer el texto del botón, se ajusta lo mínimo.
- **Personalización por dueño, ya en la base de datos.** Logo redondo o "squircle", 3 estilos de tarjeta (tecla, suave, línea), redondeo de 8 a 28 px y tipografías por separado para títulos, texto y tarjetas.
- **16 tipografías a elegir**, alojadas en tu propio sitio (sin depender de Google Fonts): Bricolage Grotesque, Sora, Space Grotesk, Unbounded, Syne, Outfit, Plus Jakarta Sans, Manrope, DM Sans, Inter Tight, Lexend, Montserrat, Rubik, Poppins, Fraunces y DM Serif Display. Solo se descarga la que eligió el dueño.
- **Seguridad, probada con 113 pruebas.**
  - Un dueño no puede ver ni tocar otro catálogo, ni su key de Gemini, ni extender sus días.
  - Vencido, su catálogo muestra "en mantenimiento" y su panel queda en solo lectura, sin perder datos.

## Lo que se dejó fuera a propósito

- **Doxeo**: búsqueda de datos personales de terceros. No va en un producto que vas a vender.
- Logos de **OnlyFans** y **Pornhub** en la biblioteca general.
- **`key.js`**: tu key de Gemini estaba en texto plano. No se copió.
  - Regenérala en AI Studio antes de la Fase 3.
  - Desde ahí, las keys van cifradas en el servidor y nunca llegan al navegador.

## Ideas para más adelante (opcionales)

- Que Lu sugiera descripciones y características al crear una plataforma nueva en el panel.
- Estadísticas de lo más consultado al asistente y de los pedidos enviados por WhatsApp.
- Dominio propio por catálogo (por ejemplo, tienda.com en vez de /c/tienda).
