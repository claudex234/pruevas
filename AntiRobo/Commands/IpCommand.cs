using AntiRobo.Capture;

namespace AntiRobo.Commands;

/// <summary>Devuelve la IP pública del equipo y el proveedor de internet.</summary>
public sealed class IpCommand(LocationProvider location) : ICommand
{
    public string Name => "ip";
    public string Description => "IP pública y proveedor de internet (ISP)";

    public async Task<string> ExecuteAsync(CancellationToken ct)
    {
        var loc = await location.GetAsync(ct);
        return $"""
            🌐 Red
            IP pública: {loc.Ip}
            ISP: {loc.Isp}
            """;
    }
}
