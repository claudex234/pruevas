namespace AntiRobo.Commands;

/// <summary>
/// Cierra la aplicación (mata el proceso matame). Responde primero por Telegram
/// y sale ~1.5 s después para que el mensaje alcance a enviarse.
/// </summary>
public sealed class KillCommand : ICommand
{
    public string Name => "matar";
    public string Description => "Cierra la app (finaliza el proceso matame)";

    public Task<string> ExecuteAsync(CancellationToken ct)
    {
        _ = Task.Run(async () =>
        {
            await Task.Delay(1500);
            Environment.Exit(0);
        });

        return Task.FromResult("🛑 Cerrando matame... el proceso se finalizará en unos segundos.");
    }
}
