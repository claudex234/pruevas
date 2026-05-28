using AntiRobo;
using AntiRobo.Bot;
using AntiRobo.Capture;
using AntiRobo.Commands;

// Instancia única: si ya hay otro matame.exe corriendo, salimos. Evita el
// conflicto de dos procesos sondeando el mismo bot de Telegram a la vez.
using var single = new Mutex(initiallyOwned: true, @"Global\AntiRobo_matame", out var isFirst);
if (!isFirst)
{
    Console.WriteLine("Ya hay otra instancia de matame en ejecución. Saliendo.");
    return 0;
}

// Título de ventana "matame" -> aparece así en Administrador de tareas (Apps),
// y el proceso es matame.exe en la pestaña Detalles. Sin icono de bandeja.
try { Console.Title = "matame"; } catch { /* sin consola interactiva */ }

Console.WriteLine("🛡️  AntiRobo iniciando (proceso: matame)...");

var configPath = Path.Combine(AppContext.BaseDirectory, "config.json");
AppConfig config;
try
{
    config = AppConfig.Load(configPath);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Error de configuración: {ex.Message}");
    return 1;
}

// --- Registro de módulos (servicios + comandos) ---
var location = new LocationProvider();

var commands = new List<ICommand>
{
    new GpsCommand(location),
    new IpCommand(location),
    new InfoCommand(),
    new KillCommand(),
};
commands.Add(new HelpCommand(commands.ToList())); // /help conoce al resto

var router = new CommandRouter(commands);
var telegram = new TelegramService(config.BotToken, config.AuthorizedChatId, router);

// Ctrl+C para cerrar limpiamente.
using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    Console.WriteLine("Cerrando...");
    cts.Cancel();
};

try
{
    await telegram.RunAsync(cts.Token);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Error fatal: {ex.Message}");
    return 1;
}

return 0;
