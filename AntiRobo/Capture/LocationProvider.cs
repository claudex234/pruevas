using System.Text.Json;

namespace AntiRobo.Capture;

/// <summary>Datos de geolocalización aproximada obtenidos por IP pública.</summary>
public sealed record LocationInfo(
    string Ip,
    string City,
    string Region,
    string Country,
    double Latitude,
    double Longitude,
    string Isp)
{
    public string MapsUrl =>
        $"https://www.google.com/maps?q={Latitude.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
        $"{Longitude.ToString(System.Globalization.CultureInfo.InvariantCulture)}";
}

/// <summary>
/// Consulta la ubicación aproximada del equipo usando la IP pública.
/// Usa ip-api.com (gratis, sin clave). No es GPS real: precisión a nivel ciudad.
/// </summary>
public sealed class LocationProvider
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };
    private const string Endpoint =
        "http://ip-api.com/json/?fields=status,message,country,regionName,city,lat,lon,isp,query";

    public async Task<LocationInfo> GetAsync(CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(await Http.GetStringAsync(Endpoint, ct));
        var root = doc.RootElement;

        if (root.GetProperty("status").GetString() != "success")
        {
            var msg = root.TryGetProperty("message", out var m) ? m.GetString() : "desconocido";
            throw new InvalidOperationException($"ip-api falló: {msg}");
        }

        return new LocationInfo(
            Ip: root.GetProperty("query").GetString() ?? "?",
            City: root.GetProperty("city").GetString() ?? "?",
            Region: root.GetProperty("regionName").GetString() ?? "?",
            Country: root.GetProperty("country").GetString() ?? "?",
            Latitude: root.GetProperty("lat").GetDouble(),
            Longitude: root.GetProperty("lon").GetDouble(),
            Isp: root.GetProperty("isp").GetString() ?? "?");
    }
}
