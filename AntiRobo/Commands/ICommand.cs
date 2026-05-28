namespace AntiRobo.Commands;

/// <summary>
/// Un comando que el bot puede ejecutar. Para añadir funciones nuevas
/// (foto de webcam, captura de pantalla, etc.) basta con crear otra clase
/// que implemente esta interfaz y registrarla en Program.cs.
/// </summary>
public interface ICommand
{
    /// <summary>Palabra que activa el comando, sin la barra. Ej: "gps", "ip".</summary>
    string Name { get; }

    /// <summary>Descripción corta mostrada en /help.</summary>
    string Description { get; }

    /// <summary>Ejecuta el comando y devuelve el texto a enviar por Telegram.</summary>
    Task<string> ExecuteAsync(CancellationToken ct);
}
