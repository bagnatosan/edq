using edq.Data;
using edq.DTO;
using edq.Models;
using Microsoft.EntityFrameworkCore;

namespace edq.Services;

public class ChatService : IChatService
{
    private readonly ApplicationDbContext _context;

    public ChatService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> CanAccessChatAsync(int userId, int groupId)
    {
        return await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == groupId && gp.PlayerId == userId)
               || await _context.Groups.AnyAsync(g => g.Id == groupId && g.CreatorId == userId);
    }

    public async Task<string?> GetGroupNameAsync(int groupId)
    {
        return await _context.Groups.AsNoTracking()
            .Where(g => g.Id == groupId)
            .Select(g => g.Name)
            .FirstOrDefaultAsync();
    }

    public async Task<List<ChatMessageDto>> GetMessagesAsync(int groupId, int skip, int take)
    {
        var messages = await _context.ChatMessages.AsNoTracking()
            .Where(m => m.GroupId == groupId)
            .OrderByDescending(m => m.SentAt)
            .Skip(skip)
            .Take(take)
            .Select(m => new ChatMessageDto
            {
                Id = m.Id,
                SenderId = m.SenderId,
                SenderName = m.Sender != null ? (m.Sender.Nickname != null && m.Sender.Nickname != "" ? m.Sender.Nickname : m.Sender.Name + " " + m.Sender.LastName) : "Desconocido",
                SenderInitials = m.Sender != null ? m.Sender.Initials : "",
                PhotoUrl = m.Sender != null ? m.Sender.PhotoUrl : null,
                MessageText = m.MessageText,
                SentAt = m.SentAt
            })
            .ToListAsync();

        messages.Reverse();
        return messages;
    }

    public async Task<PollDto?> CreatePollAsync(int userId, int groupId, string question, List<string> options, int durationMinutes, DateTime? targetDate)
    {
        var poll = new Poll
        {
            GroupId = groupId,
            CreatorId = userId,
            Question = question.Trim(),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(durationMinutes > 0 ? durationMinutes : 1440),
            IsActive = true,
            TargetDate = targetDate
        };

        foreach (var opt in options)
        {
            if (!string.IsNullOrWhiteSpace(opt))
            {
                poll.Options.Add(new PollOption { OptionText = opt.Trim() });
            }
        }

        if (poll.Options.Count < 1)
        {
            return null;
        }

        _context.Polls.Add(poll);
        await _context.SaveChangesAsync();

        var creator = await _context.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == userId);
        var creatorName = creator != null ? (!string.IsNullOrWhiteSpace(creator.Nickname) ? creator.Nickname : $"{creator.Name} {creator.LastName}") : "Desconocido";

        return new PollDto
        {
            Id = poll.Id,
            CreatorId = userId,
            CreatorName = creatorName,
            CreatorInitials = creator?.Initials ?? "",
            CreatorPhotoUrl = creator?.PhotoUrl,
            Question = poll.Question,
            CreatedAt = poll.CreatedAt,
            ExpiresAt = poll.ExpiresAt,
            TargetDate = poll.TargetDate,
            Options = poll.Options.Select(o => new PollOptionDto
            {
                Id = o.Id,
                OptionText = o.OptionText,
                VoteCount = 0,
                UserVoted = false
            }).ToList()
        };
    }

    public async Task<List<PollDto>> GetActivePollsAsync(int userId, int groupId)
    {
        var now = DateTime.UtcNow;
        return await _context.Polls.AsNoTracking()
            .Where(p => p.GroupId == groupId && p.IsActive && p.ExpiresAt > now)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PollDto
            {
                Id = p.Id,
                CreatorId = p.CreatorId,
                CreatorName = p.Creator != null ? (p.Creator.Nickname != null && p.Creator.Nickname != "" ? p.Creator.Nickname : p.Creator.Name + " " + p.Creator.LastName) : "Desconocido",
                CreatorInitials = p.Creator != null ? p.Creator.Initials : "",
                CreatorPhotoUrl = p.Creator != null ? p.Creator.PhotoUrl : null,
                Question = p.Question,
                CreatedAt = p.CreatedAt,
                ExpiresAt = p.ExpiresAt,
                TargetDate = p.TargetDate,
                Options = p.Options.Select(o => new PollOptionDto
                {
                    Id = o.Id,
                    OptionText = o.OptionText,
                    VoteCount = o.Votes.Count,
                    UserVoted = o.Votes.Any(v => v.PlayerId == userId),
                    Voters = o.Votes.Select(v => new PollVoterDto
                    {
                        PlayerId = v.PlayerId,
                        Name = v.Player != null ? v.Player.Name + " " + v.Player.LastName : "Desconocido",
                        Nickname = v.Player != null ? v.Player.Nickname : null,
                        Initials = v.Player != null ? v.Player.Initials : "",
                        PhotoUrl = v.Player != null ? v.Player.PhotoUrl : null
                    }).ToList()
                }).ToList()
            })
            .ToListAsync();
    }

    public async Task<(bool Success, int GroupId, object? UpdatedPollData)> VoteAsync(int userId, int pollId, int optionId)
    {
        var poll = await _context.Polls.AsNoTracking()
            .Select(p => new { p.Id, p.IsActive, p.ExpiresAt, p.GroupId })
            .FirstOrDefaultAsync(p => p.Id == pollId);

        if (poll == null || !poll.IsActive || poll.ExpiresAt <= DateTime.UtcNow)
        {
            return (false, 0, null);
        }

        var optionExists = await _context.PollOptions.AnyAsync(o => o.Id == optionId && o.PollId == pollId);
        if (!optionExists)
        {
            return (false, 0, null);
        }

        var existingVote = await _context.PollVotes
            .FirstOrDefaultAsync(v => v.PollId == pollId && v.PlayerId == userId);

        if (existingVote != null)
        {
            _context.PollVotes.Remove(existingVote);

            if (existingVote.PollOptionId != optionId)
            {
                var newVote = new PollVote
                {
                    PollId = pollId,
                    PollOptionId = optionId,
                    PlayerId = userId,
                    VotedAt = DateTime.UtcNow
                };
                _context.PollVotes.Add(newVote);
            }
        }
        else
        {
            var newVote = new PollVote
            {
                PollId = pollId,
                PollOptionId = optionId,
                PlayerId = userId,
                VotedAt = DateTime.UtcNow
            };
            _context.PollVotes.Add(newVote);
        }

        await _context.SaveChangesAsync();

        var updatedOptions = await _context.PollOptions.AsNoTracking()
            .Where(o => o.PollId == pollId)
            .Select(o => new
            {
                id = o.Id,
                optionText = o.OptionText,
                voteCount = o.Votes.Count,
                voters = o.Votes.Select(v => new
                {
                    playerId = v.PlayerId,
                    name = v.Player != null ? v.Player.Name + " " + v.Player.LastName : "Desconocido",
                    nickname = v.Player != null ? v.Player.Nickname : null,
                    initials = v.Player != null ? v.Player.Initials : "",
                    photoUrl = v.Player != null ? v.Player.PhotoUrl : null
                }).ToList()
            })
            .ToListAsync();

        var updatedPollData = new
        {
            pollId = poll.Id,
            options = updatedOptions
        };

        return (true, poll.GroupId, updatedPollData);
    }

    public async Task<List<int>> GetLatestPollVotersAsync(int groupId)
    {
        // Obtener el ID de la última encuesta y sus opciones con sus conteos de votos
        var latestPollInfo = await _context.Polls.AsNoTracking()
            .Where(p => p.GroupId == groupId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id,
                Options = p.Options.Select(o => new
                {
                    o.Id,
                    VoteCount = o.Votes.Count
                }).ToList()
            })
            .FirstOrDefaultAsync();

        if (latestPollInfo == null || !latestPollInfo.Options.Any())
        {
            return new List<int>();
        }

        // Encontrar el máximo número de votos entre las opciones
        var maxVotes = latestPollInfo.Options.Max(o => o.VoteCount);
        if (maxVotes == 0)
        {
            return new List<int>();
        }

        // Obtener los IDs de las opciones ganadoras
        var winningOptionIds = latestPollInfo.Options
            .Where(o => o.VoteCount == maxVotes)
            .Select(o => o.Id)
            .ToList();

        // Buscar en la BD los PlayerId que votaron por esas opciones
        return await _context.PollVotes.AsNoTracking()
            .Where(v => v.PollId == latestPollInfo.Id && winningOptionIds.Contains(v.PollOptionId))
            .Select(v => v.PlayerId)
            .Distinct()
            .ToListAsync();
    }
}
