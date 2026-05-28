using Telegram.Bot;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace AntiRobo.Bot;

/// <summary>
/// Mantiene el sondeo (long polling) de Telegram. Solo procesa mensajes del
/// chat autorizado y delega los comandos al CommandRouter. No envía nada por
/// su cuenta: únicamente responde cuando recibe un comando.
/// </summary>
public sealed class TelegramService
{
    private readonly TelegramBotClient _bot;
    private readonly long _authorizedChatId;
    private readonly CommandRouter _router;

    public TelegramService(string token, long authorizedChatId, CommandRouter router)
    {
        _bot = new TelegramBotClient(token);
        _authorizedChatId = authorizedChatId;
        _router = router;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        await ConnectWithRetryAsync(ct);

        var options = new ReceiverOptions { AllowedUpdates = [UpdateType.Message] };
        _bot.StartReceiving(HandleUpdateAsync, HandleErrorAsync, options, ct);

        try
        {
            await Task.Delay(Timeout.Infinite, ct);
        }
        catch (OperationCanceledException)
        {
            // cierre solicitado
        }
    }

    /// <summary>
    /// Espera a que haya internet. Si el PC arranca sin red (típico: el WiFi
    /// aún no conectó), reintenta con espera creciente en vez de cerrarse.
    /// </summary>
    private async Task ConnectWithRetryAsync(CancellationToken ct)
    {
        var delay = TimeSpan.FromSeconds(5);
        var maxDelay = TimeSpan.FromMinutes(2);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                var me = await _bot.GetMe(ct);
                Console.WriteLine($"Bot conectado como @{me.Username}. Escuchando comandos del chat {_authorizedChatId}...");
                return;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Sin conexión ({ex.Message}). Reintentando en {delay.TotalSeconds:0}s...");
                await Task.Delay(delay, ct);
                delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, maxDelay.TotalSeconds));
            }
        }
    }

    private async Task HandleUpdateAsync(ITelegramBotClient bot, Update update, CancellationToken ct)
    {
        if (update.Message is not { Text: { } text } message)
            return;

        if (message.Chat.Id != _authorizedChatId)
        {
            Console.WriteLine($"Mensaje ignorado de chat no autorizado: {message.Chat.Id}");
            return;
        }

        var reply = await _router.DispatchAsync(text, ct);
        if (reply is not null)
            await bot.SendMessage(message.Chat.Id, reply, cancellationToken: ct);
    }

    private Task HandleErrorAsync(ITelegramBotClient bot, Exception exception, HandleErrorSource source, CancellationToken ct)
    {
        Console.WriteLine($"Error de Telegram ({source}): {exception.Message}");
        return Task.CompletedTask;
    }
}
