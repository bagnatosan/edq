using edq.Data;
using edq.DTO;
using edq.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
        var group = await _context.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
        return group?.Name;
    }

    public async Task<List<ChatMessageDto>> GetMessagesAsync(int groupId, int skip, int take)
    {
        var messages = await _context.ChatMessages.AsNoTracking()
            .Include(m => m.Sender)
            .Where(m => m.GroupId == groupId)
            .OrderByDescending(m => m.SentAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync();

        return messages.Select(m => new ChatMessageDto
        {
            Id = m.Id,
            SenderId = m.SenderId,
            SenderName = !string.IsNullOrWhiteSpace(m.Sender?.Nickname) ? m.Sender.Nickname : $"{m.Sender?.Name} {m.Sender?.LastName}",
            SenderInitials = m.Sender?.Initials ?? "",
            PhotoUrl = m.Sender?.PhotoUrl,
            MessageText = m.MessageText,
            SentAt = m.SentAt
        }).Reverse().ToList();
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
        var polls = await _context.Polls.AsNoTracking()
            .Include(p => p.Creator)
            .Include(p => p.Options)
                .ThenInclude(o => o.Votes)
                    .ThenInclude(v => v.Player)
            .Where(p => p.GroupId == groupId && p.IsActive && p.ExpiresAt > now)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return polls.Select(p => {
            var creatorName = p.Creator != null ? (!string.IsNullOrWhiteSpace(p.Creator.Nickname) ? p.Creator.Nickname : $"{p.Creator.Name} {p.Creator.LastName}") : "Desconocido";
            return new PollDto
            {
                Id = p.Id,
                CreatorId = p.CreatorId,
                CreatorName = creatorName,
                CreatorInitials = p.Creator?.Initials ?? "",
                CreatorPhotoUrl = p.Creator?.PhotoUrl,
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
                        Name = v.Player != null ? $"{v.Player.Name} {v.Player.LastName}" : "Desconocido",
                        Nickname = v.Player != null ? v.Player.Nickname : null,
                        Initials = v.Player != null ? v.Player.Initials : "",
                        PhotoUrl = v.Player != null ? v.Player.PhotoUrl : null
                    }).ToList()
                }).ToList()
            };
        }).ToList();
    }

    public async Task<(bool Success, int GroupId, object? UpdatedPollData)> VoteAsync(int userId, int pollId, int optionId)
    {
        var poll = await _context.Polls.AsNoTracking()
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.Id == pollId);

        if (poll == null || !poll.IsActive || poll.ExpiresAt <= DateTime.UtcNow)
        {
            return (false, 0, null);
        }

        var option = poll.Options.FirstOrDefault(o => o.Id == optionId);
        if (option == null)
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
            .Include(o => o.Votes)
                .ThenInclude(v => v.Player)
            .Where(o => o.PollId == pollId)
            .Select(o => new
            {
                id = o.Id,
                optionText = o.OptionText,
                voteCount = o.Votes.Count,
                voters = o.Votes.Select(v => new
                {
                    playerId = v.PlayerId,
                    name = v.Player != null ? $"{v.Player.Name} {v.Player.LastName}" : "Desconocido",
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
        // Obtener la última encuesta del grupo, incluyendo opciones y votos
        var latestPoll = await _context.Polls.AsNoTracking()
            .Include(p => p.Options)
                .ThenInclude(o => o.Votes)
            .Where(p => p.GroupId == groupId)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        if (latestPoll == null || !latestPoll.Options.Any())
        {
            return new List<int>();
        }

        // Encontrar el máximo número de votos entre las opciones
        var maxVotes = latestPoll.Options.Max(o => o.Votes.Count);
        if (maxVotes == 0)
        {
            return new List<int>();
        }

        // Seleccionar todos los PlayerId que votaron por las opciones que obtuvieron el máximo de votos
        var voterIds = latestPoll.Options
            .Where(o => o.Votes.Count == maxVotes)
            .SelectMany(o => o.Votes)
            .Select(v => v.PlayerId)
            .Distinct()
            .ToList();

        return voterIds;
    }
}
