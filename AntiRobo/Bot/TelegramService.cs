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
        var me = await _bot.GetMe(ct);
        Console.WriteLine($"Bot conectado como @{me.Username}. Escuchando comandos del chat {_authorizedChatId}...");

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
