using System.Text.Json;

namespace AntiRobo;

/// <summary>
/// Configuración cargada desde config.json. El token del bot y el chat ID
/// autorizado nunca se escriben en el código fuente.
/// </summary>
public sealed class AppConfig
{
    public string BotToken { get; init; } = "";

    /// <summary>Único chat de Telegram autorizado a enviar comandos.</summary>
    public long AuthorizedChatId { get; init; }

    public static AppConfig Load(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException(
                $"No se encontró '{path}'. Copia config.example.json a config.json y rellena tus datos.");

        var json = File.ReadAllText(path);
        var config = JsonSerializer.Deserialize<AppConfig>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? throw new InvalidDataException("config.json está vacío o mal formado.");

        if (string.IsNullOrWhiteSpace(config.BotToken))
            throw new InvalidDataException("Falta 'BotToken' en config.json.");
        if (config.AuthorizedChatId == 0)
            throw new InvalidDataException("Falta 'AuthorizedChatId' en config.json.");

        return config;
    }
}
