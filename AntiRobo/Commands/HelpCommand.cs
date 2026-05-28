namespace AntiRobo.Commands;

/// <summary>Lista todos los comandos disponibles.</summary>
public sealed class HelpCommand(IReadOnlyCollection<ICommand> commands) : ICommand
{
    public string Name => "help";
    public string Description => "Muestra esta lista de comandos";

    public Task<string> ExecuteAsync(CancellationToken ct)
    {
        var lines = commands
            .OrderBy(c => c.Name)
            .Select(c => $"/{c.Name} — {c.Description}");

        var text = "🛡️ AntiRobo — comandos disponibles\n\n" + string.Join("\n", lines);
        return Task.FromResult(text);
    }
}
