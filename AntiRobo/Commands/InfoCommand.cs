using System.Net.NetworkInformation;

namespace AntiRobo.Commands;

/// <summary>Información local del equipo: nombre, usuario, tiempo encendido y red local.</summary>
public sealed class InfoCommand : ICommand
{
    public string Name => "info";
    public string Description => "Nombre del equipo, usuario y datos del sistema";

    public Task<string> ExecuteAsync(CancellationToken ct)
    {
        var uptime = TimeSpan.FromMilliseconds(Environment.TickCount64);
        var localIps = GetLocalIps();

        var text = $"""
            💻 Equipo
            Nombre: {Environment.MachineName}
            Usuario: {Environment.UserName}
            SO: {Environment.OSVersion}
            Encendido hace: {uptime.Days}d {uptime.Hours}h {uptime.Minutes}m
            IP(s) local(es): {localIps}
            """;
        return Task.FromResult(text);
    }

    private static string GetLocalIps()
    {
        var ips = NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up)
            .SelectMany(n => n.GetIPProperties().UnicastAddresses)
            .Where(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
            .Select(a => a.Address.ToString())
            .Where(ip => ip != "127.0.0.1")
            .ToArray();

        return ips.Length > 0 ? string.Join(", ", ips) : "no disponible";
    }
}
