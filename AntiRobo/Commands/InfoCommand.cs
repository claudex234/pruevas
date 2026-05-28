using System.Net.NetworkInformation;
using System.Reflection;

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
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "?";
        var built = GetBuildTime();

        var text = $"""
            💻 Equipo
            Nombre: {Environment.MachineName}
            Usuario: {Environment.UserName}
            SO: {Environment.OSVersion}
            Encendido hace: {uptime.Days}d {uptime.Hours}h {uptime.Minutes}m
            IP(s) local(es): {localIps}
            Versión: {version}
            Compilado: {built}
            """;
        return Task.FromResult(text);
    }

    /// <summary>Fecha del .exe en ejecución: sirve para saber si corres el último build.</summary>
    private static string GetBuildTime()
    {
        try
        {
            var path = Environment.ProcessPath;
            return path is not null
                ? File.GetLastWriteTime(path).ToString("yyyy-MM-dd HH:mm")
                : "?";
        }
        catch
        {
            return "?";
        }
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
