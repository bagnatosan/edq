using edq.DTO;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace edq.Services;

public interface IMatchService
{
    Task<List<UserUpcomingMatchDto>> GetUpcomingMatchesForUserAsync(int userId);
    Task<MatchDetailsDto?> GetMatchDetailsAsync(int matchId, int userId);
    Task<bool> UpdateMatchPlayersAsync(int matchId, int userId, List<MatchPlayerUpdateDto> players, DateTime date);
    Task<bool> FinishMatchAsync(int matchId, int userId, string scoreState);
}
