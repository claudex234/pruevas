# 🛡️ AntiRobo

App de consola en **C# / .NET 8** para Windows 11. No tiene ventana ni formularios:
se queda escuchando tu bot de Telegram y **solo responde cuando le envías un comando**
desde tu chat autorizado. Nunca envía nada por su cuenta.

> ⚠️ Úsalo solo en equipos de tu propiedad. La "ubicación" es aproximada (por IP
> pública, precisión a nivel de ciudad): no es GPS real, porque los PC no tienen GPS.

## Comandos

| Comando | Qué hace |
|---------|----------|
| `/gps`  | Ubicación aproximada (por IP) + enlace a Google Maps |
| `/ip`   | IP pública y proveedor de internet (ISP) |
| `/info` | Nombre del equipo, usuario, SO, tiempo encendido, IPs locales |
| `/matar` | Cierra la app (finaliza el proceso matame) |
| `/help` | Lista los comandos |

Funciona con o sin la barra (`/ip` o `ip`) y no distingue mayúsculas.

## Estructura (modular)

```
AntiRobo/
├── AntiRobo.csproj          .NET 8 + Telegram.Bot
├── config.example.json      plantilla (copiar a config.json)
├── Program.cs               arranque: registra módulos y comandos
├── AppConfig.cs             carga token + chat ID desde config.json
├── Bot/
│   ├── TelegramService.cs   long polling; filtra el chat autorizado
│   └── CommandRouter.cs     identifica el comando y lo ejecuta
├── Commands/
│   ├── ICommand.cs          interfaz: cada comando es un módulo
│   ├── GpsCommand.cs
│   ├── IpCommand.cs
│   ├── InfoCommand.cs
│   └── HelpCommand.cs
└── Capture/
    └── LocationProvider.cs  geolocalización por IP (ip-api.com, gratis)
```

**Añadir un comando nuevo** (ej. captura de pantalla): crea una clase que implemente
`ICommand` y regístrala en la lista de `Program.cs`. Nada más.

## Configuración

1. Crea el bot con [@BotFather](https://t.me/BotFather) y copia el **token**.
2. Averigua tu **chat ID**: escribe a [@userinfobot](https://t.me/userinfobot).
3. Copia la plantilla y rellena tus datos:

```bash
cp config.example.json config.json
```

```json
{
  "BotToken": "123456789:AA-tu-token",
  "AuthorizedChatId": 123456789
}
```

`config.json` está en `.gitignore`: tu token nunca se sube al repo.

## Probar en tu PC (D:\claude\test) — copia y pega en CMD

```bat
cls
D:
cd \claude\test
git clone https://github.com/claudex234/pruevas.git
cd pruevas\AntiRobo
copy config.example.json config.json
notepad config.json
```

En el Notepad que se abre, pon tu token y tu chat ID, guarda y cierra:

```json
{
  "BotToken": "PEGA-AQUI-TU-TOKEN-DE-BOTFATHER",
  "AuthorizedChatId": PEGA-AQUI-TU-CHAT-ID
}
```

Luego compila y arranca (sigue en la misma ventana de CMD):

```bat
dotnet restore
dotnet build -c Release
dotnet run -c Release
```

Deja la consola abierta y mándale `/help` al bot desde Telegram. Para detener la
prueba: `Ctrl + C` en la consola.

### Generar matame.exe (autónomo) para Windows 11

Para llevarlo a tu PC sin instalar .NET, publica un ejecutable único:

```bat
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
```

El ejecutable queda en `bin\Release\net8.0\win-x64\publish\matame.exe`.

### Encontrarlo y matarlo

- En el **Administrador de tareas** > pestaña **Detalles**: busca `matame.exe`,
  clic derecho > *Finalizar tarea*.
- También aparece como **matame** en la pestaña *Procesos* (por el título de ventana).
- No tiene icono de bandeja: es un proceso de consola normal, se mata como cualquiera.

> Para que arranque solo al encender Windows, copia `matame.exe` (o un acceso directo)
> a la carpeta de inicio: pulsa `Win + R`, escribe `shell:startup` y pega ahí el acceso.
