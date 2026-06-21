using edq.DTO;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace edq.Services;

public interface IChatService
{
    Task<bool> CanAccessChatAsync(int userId, int groupId);
    Task<string?> GetGroupNameAsync(int groupId);
    Task<List<ChatMessageDto>> GetMessagesAsync(int groupId, int skip, int take);
    Task<PollDto?> CreatePollAsync(int userId, int groupId, string question, List<string> options, int durationMinutes);
    Task<List<PollDto>> GetActivePollsAsync(int userId, int groupId);
    Task<(bool Success, int GroupId, object? UpdatedPollData)> VoteAsync(int userId, int pollId, int optionId);
}
