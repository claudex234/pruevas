using AntiRobo.Commands;

namespace AntiRobo.Bot;

/// <summary>
/// Recibe texto, identifica el comando y lo ejecuta. No conoce nada de Telegram,
/// por eso se puede probar de forma aislada.
/// </summary>
public sealed class CommandRouter
{
    private readonly Dictionary<string, ICommand> _commands;

    public CommandRouter(IEnumerable<ICommand> commands)
        => _commands = commands.ToDictionary(c => c.Name, StringComparer.OrdinalIgnoreCase);

    public async Task<string?> DispatchAsync(string? text, CancellationToken ct)
    {
        var name = Parse(text);
        if (name is null)
            return null; // no es un comando: se ignora

        if (!_commands.TryGetValue(name, out var command))
            return $"Comando desconocido: {name}. Usa /help.";

        try
        {
            return await command.ExecuteAsync(ct);
        }
        catch (Exception ex)
        {
            return $"⚠️ Error al ejecutar {name}: {ex.Message}";
        }
    }

    /// <summary>Acepta "/gps", "gps", "/gps@MiBot" o "gps argumentos".</summary>
    private static string? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var token = text.Trim().TrimStart('/').Split(' ', '@')[0];
        return string.IsNullOrEmpty(token) ? null : token;
    }
}
