using AntiRobo.Capture;

namespace AntiRobo.Commands;

/// <summary>Devuelve la ubicación aproximada (por IP) y un enlace a Google Maps.</summary>
public sealed class GpsCommand(LocationProvider location) : ICommand
{
    public string Name => "gps";
    public string Description => "Ubicación aproximada del equipo (por IP) + enlace a Maps";

    public async Task<string> ExecuteAsync(CancellationToken ct)
    {
        var loc = await location.GetAsync(ct);
        return $"""
            📍 Ubicación aproximada
            Ciudad: {loc.City}, {loc.Region}
            País: {loc.Country}
            Coordenadas: {loc.Latitude}, {loc.Longitude}
            Maps: {loc.MapsUrl}
            """;
    }
}
