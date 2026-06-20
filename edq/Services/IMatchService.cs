using edq.DTO;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace edq.Services;

public interface IMatchService
{
    Task<List<UserUpcomingMatchDto>> GetUpcomingMatchesForUserAsync(int userId);
}
