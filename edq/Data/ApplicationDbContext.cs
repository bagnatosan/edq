using edq.Models;
using Microsoft.EntityFrameworkCore;

namespace edq.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) {}
    
    public DbSet<Group> Groups { get; set; }
    public DbSet<Player> Players { get; set; }
    public DbSet<GroupPlayer> GroupPlayers { get; set; }
    public DbSet<Match> Matches { get; set; }
    public DbSet<MatchPlayer>  MatchPlayers { get; set; }
    public DbSet<Request> Requests { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        
        modelBuilder.Entity<GroupPlayer>()
            .HasKey(gj => new { gj.GroupId, gj.PlayerId }); 

        modelBuilder.Entity<MatchPlayer>()
            .HasKey(mp => new { mp.MatchId, mp.PlayerId });

        // Previene solicitudes duplicadas concurrentes (ej. clicks rápidos en el frontend)
        modelBuilder.Entity<Request>()
            .HasIndex(s => new { s.GroupId, s.PlayerId })
            .IsUnique();

        // Configuración de la relación de Creador del Grupo (evitando borrado en cascada cíclico)
        modelBuilder.Entity<Group>()
            .HasOne(g => g.Creator)
            .WithMany()
            .HasForeignKey(g => g.CreatorId)
            .OnDelete(DeleteBehavior.Restrict);

        // Relaciones muchos a muchos con borrado restrictivo para GroupPlayer (Integrantes)
        modelBuilder.Entity<GroupPlayer>()
            .HasOne(gp => gp.Group)
            .WithMany(g => g.GroupPlayers)
            .HasForeignKey(gp => gp.GroupId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupPlayer>()
            .HasOne(gp => gp.Player)
            .WithMany()
            .HasForeignKey(gp => gp.PlayerId)
            .OnDelete(DeleteBehavior.Restrict);

        // Relaciones muchos a muchos con borrado restrictivo para MatchPlayer (Convocados)
        modelBuilder.Entity<MatchPlayer>()
            .HasOne(mp => mp.Match)
            .WithMany(m => m.MatchPlayers)
            .HasForeignKey(mp => mp.MatchId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MatchPlayer>()
            .HasOne(mp => mp.Player)
            .WithMany()
            .HasForeignKey(mp => mp.PlayerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}