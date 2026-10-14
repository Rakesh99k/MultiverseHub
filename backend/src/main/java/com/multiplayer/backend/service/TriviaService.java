package com.multiplayer.backend.service;

import com.multiplayer.backend.model.TriviaGameState;
import com.multiplayer.backend.model.TriviaQuestion;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;

@Service
public class TriviaService {

    // ─── Question Bank ───────────────────────────────────────────────────────

    private static final List<TriviaQuestion> QUESTION_BANK = List.of(
        new TriviaQuestion(1, "In Naruto, what is the name of the Nine-Tailed Fox sealed inside Naruto?",
            List.of("Shukaku", "Kurama", "Matatabi", "Son Goku"), 1, "Naruto"),

        new TriviaQuestion(2, "What Devil Fruit did Monkey D. Luffy eat in One Piece?",
            List.of("Mera Mera no Mi", "Gomu Gomu no Mi", "Ope Ope no Mi", "Yami Yami no Mi"), 1, "One Piece"),

        new TriviaQuestion(3, "In Attack on Titan, what are the names of the three walls?",
            List.of("Alpha, Beta, Gamma", "Maria, Rose, Sina", "North, South, East", "Heaven, Earth, Hell"), 1, "Attack on Titan"),

        new TriviaQuestion(4, "What is the name of the Shinigami who drops the Death Note?",
            List.of("Rem", "Ryuk", "Sidoh", "Gelus"), 1, "Death Note"),

        new TriviaQuestion(5, "In Dragon Ball Z, what race is Goku?",
            List.of("Namekian", "Frieza Race", "Saiyan", "Human"), 2, "Dragon Ball Z"),

        new TriviaQuestion(6, "What is Izuku Midoriya's hero name in My Hero Academia?",
            List.of("All Might", "Dynamight", "Deku", "Shoto"), 2, "My Hero Academia"),

        new TriviaQuestion(7, "In Demon Slayer, what breathing style does Tanjiro primarily use?",
            List.of("Flame Breathing", "Thunder Breathing", "Water Breathing", "Wind Breathing"), 2, "Demon Slayer"),

        new TriviaQuestion(8, "What is the name of Gojo Satoru's signature technique in Jujutsu Kaisen?",
            List.of("Domain Expansion", "Limitless", "Cursed Speech", "Shadow Manipulation"), 1, "Jujutsu Kaisen"),

        new TriviaQuestion(9, "In Hunter x Hunter, what is Gon's Nen type?",
            List.of("Transmutation", "Conjuration", "Enhancement", "Emission"), 2, "Hunter x Hunter"),

        new TriviaQuestion(10, "What is the name of Ichigo Kurosaki's Zanpakuto in Bleach?",
            List.of("Senbonzakura", "Zangetsu", "Hyorinmaru", "Kyoka Suigetsu"), 1, "Bleach"),

        new TriviaQuestion(11, "In Fullmetal Alchemist, what are the Elric brothers trying to find?",
            List.of("The One Ring", "Philosopher's Stone", "Dragon Balls", "Death Note"), 1, "Fullmetal Alchemist"),

        new TriviaQuestion(12, "Who is the main protagonist of Cowboy Bebop?",
            List.of("Jet Black", "Spike Spiegel", "Vicious", "Ein"), 1, "Cowboy Bebop"),

        new TriviaQuestion(13, "In Neon Genesis Evangelion, who pilots Unit-01?",
            List.of("Rei Ayanami", "Asuka Langley", "Shinji Ikari", "Misato Katsuragi"), 2, "Evangelion"),

        new TriviaQuestion(14, "What is the name of the time machine in Steins;Gate?",
            List.of("DeLorean", "TARDIS", "Phone Microwave", "Time Leap Machine"), 2, "Steins;Gate"),

        new TriviaQuestion(15, "In Code Geass, what is the name of Lelouch's power?",
            List.of("Sharingan", "Geass", "Nen", "Stand"), 1, "Code Geass"),

        new TriviaQuestion(16, "Who created the death game in Sword Art Online?",
            List.of("Sugou Nobuyuki", "Akihiko Kayaba", "Kikuoka Seijirou", "Kirigaya Kazuto"), 1, "Sword Art Online"),

        new TriviaQuestion(17, "In Mob Psycho 100, what is Mob's real name?",
            List.of("Teruki Hanazawa", "Shigeo Kageyama", "Ritsu Kageyama", "Reigen Arataka"), 1, "Mob Psycho 100"),

        new TriviaQuestion(18, "What is Saitama's hero rank at the start of One Punch Man?",
            List.of("S-Class", "A-Class", "B-Class", "C-Class"), 3, "One Punch Man"),

        new TriviaQuestion(19, "In Chainsaw Man, what is the name of Denji's devil companion?",
            List.of("Makima", "Power", "Pochita", "Aki"), 2, "Chainsaw Man"),

        new TriviaQuestion(20, "What special ability does Anya Forger have in Spy x Family?",
            List.of("Super strength", "Telepathy", "Invisibility", "Time stop"), 1, "Spy x Family"),

        new TriviaQuestion(21, "In Vinland Saga, who is Thorfinn's father?",
            List.of("Askeladd", "Thors", "Canute", "Thorkell"), 1, "Vinland Saga"),

        new TriviaQuestion(22, "What is the name of Guts' massive sword in Berserk?",
            List.of("Excalibur", "Dragon Slayer", "Zanpakuto", "Buster Sword"), 1, "Berserk"),

        new TriviaQuestion(23, "In Fairy Tail, what type of magic does Natsu Dragneel use?",
            List.of("Ice Make", "Fire Dragon Slayer", "Lightning God", "Iron Dragon Slayer"), 1, "Fairy Tail"),

        new TriviaQuestion(24, "What makes Asta's grimoire unique in Black Clover?",
            List.of("It's a four-leaf clover", "It's a five-leaf clover", "It's golden", "It's blank"), 1, "Black Clover"),

        new TriviaQuestion(25, "In Tokyo Ghoul, what type of ghoul is Kaneki Ken?",
            List.of("Natural-born", "Kakuja", "One-eyed", "Artificial"), 2, "Tokyo Ghoul"),

        new TriviaQuestion(26, "What is the name of the pirate crew led by Shanks in One Piece?",
            List.of("Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"), 1, "One Piece"),

        new TriviaQuestion(27, "In Death Note, what is L's real name?",
            List.of("Light Yagami", "L Lawliet", "Near", "Mello"), 1, "Death Note"),

        new TriviaQuestion(28, "What is the name of the academy in My Hero Academia?",
            List.of("Kunugigaoka", "U.A. High School", "Shibusen", "Ousai Academy"), 1, "My Hero Academia"),

        new TriviaQuestion(29, "In Attack on Titan, what is Eren Yeager's Titan form called?",
            List.of("Armored Titan", "Colossal Titan", "Attack Titan", "Beast Titan"), 2, "Attack on Titan"),

        new TriviaQuestion(30, "What is the name of the organization in Jujutsu Kaisen that employs sorcerers?",
            List.of("Jujutsu High", "Shinigami Academy", "Hunter Association", "Gotei 13"), 0, "Jujutsu Kaisen")
    );

    // ─── Internal Game Wrapper ───────────────────────────────────────────────

    private static class TriviaGame {
        final Object lock = new Object();
        final TriviaGameState state = new TriviaGameState();
        final List<TriviaQuestion> questions = new ArrayList<>();
        ScheduledFuture<?> roundTimer = null;
        ScheduledFuture<?> advanceTimer = null;
    }

    private final ConcurrentMap<String, TriviaGame> games = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final LobbyService lobbyService;
    private final SimpMessagingTemplate messagingTemplate;

    public TriviaService(@Lazy LobbyService lobbyService, SimpMessagingTemplate messagingTemplate) {
        this.lobbyService = lobbyService;
        this.messagingTemplate = messagingTemplate;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    public TriviaGameState createGame(String gameId, int totalRounds, int timeLimit) {
        if (gameId == null || gameId.isBlank()) return null;
        if (totalRounds < 1) totalRounds = 10;
        if (totalRounds > QUESTION_BANK.size()) totalRounds = QUESTION_BANK.size();
        if (timeLimit < 5) timeLimit = 15;

        TriviaGame game = new TriviaGame();
        game.state.setTotalRounds(totalRounds);
        game.state.setTimeLimitSeconds(timeLimit);

        // Shuffle and pick questions
        List<TriviaQuestion> shuffled = new ArrayList<>(QUESTION_BANK);
        Collections.shuffle(shuffled, ThreadLocalRandom.current());
        game.questions.addAll(shuffled.subList(0, totalRounds));

        games.putIfAbsent(gameId, game);
        return toClientState(game);
    }

    public TriviaGameState getGame(String gameId) {
        TriviaGame game = games.get(gameId);
        if (game == null) return null;
        synchronized (game.lock) {
            return toClientState(game);
        }
    }

    public TriviaGameState joinGame(String gameId, String playerName) {
        TriviaGame game = games.get(gameId);
        if (game == null || playerName == null || playerName.isBlank()) return null;
        synchronized (game.lock) {
            if (!"WAITING".equals(game.state.getStatus())) return null;
            String trimmed = playerName.trim();
            if (!game.state.getPlayers().contains(trimmed)) {
                game.state.getPlayers().add(trimmed);
                game.state.getScores().put(trimmed, 0);
            }
            return toClientState(game);
        }
    }

    /**
     * Start the trivia game.
     */
    public TriviaGameState startGame(String gameId) {
        TriviaGame game = games.get(gameId);
        if (game == null) return null;
        synchronized (game.lock) {
            if (!"WAITING".equals(game.state.getStatus())) return null;
            if (game.state.getPlayers().isEmpty()) return null;
            startRound(game, gameId);
            return toClientState(game);
        }
    }

    /**
     * Submit an answer for the current round.
     */
    public TriviaGameState submitAnswer(String gameId, String playerName, int optionIndex) {
        TriviaGame game = games.get(gameId);
        if (game == null) return null;
        synchronized (game.lock) {
            if (!"PLAYING".equals(game.state.getStatus())) return toClientState(game);
            if (optionIndex < 0 || optionIndex > 3) return toClientState(game);

            String trimmed = playerName.trim();
            if (!game.state.getPlayers().contains(trimmed)) return toClientState(game);
            if (game.state.getPlayerAnswers().containsKey(trimmed)) return toClientState(game);

            // Record answer
            game.state.getPlayerAnswers().put(trimmed, optionIndex);

            // Check correctness
            TriviaQuestion q = game.questions.get(game.state.getCurrentRound() - 1);
            boolean correct = (optionIndex == q.getCorrectIndex());
            game.state.getPlayerCorrect().put(trimmed, correct);

            // First correct bonus
            if (correct && game.state.getFirstCorrectPlayer() == null) {
                game.state.setFirstCorrectPlayer(trimmed);
            }

            // Check if all players answered → end round early
            if (game.state.getPlayerAnswers().size() >= game.state.getPlayers().size()) {
                endRound(game, gameId);
            }

            return toClientState(game);
        }
    }

    public boolean resetGame(String gameId) {
        TriviaGame game = games.get(gameId);
        if (game == null) return false;
        synchronized (game.lock) {
            cancelTimers(game);

            List<TriviaQuestion> shuffled = new ArrayList<>(QUESTION_BANK);
            Collections.shuffle(shuffled, ThreadLocalRandom.current());
            game.questions.clear();
            game.questions.addAll(shuffled.subList(0, Math.min(game.state.getTotalRounds(), shuffled.size())));

            List<String> players = new ArrayList<>(game.state.getPlayers());
            int totalRounds = game.state.getTotalRounds();
            int timeLimit = game.state.getTimeLimitSeconds();

            game.state.setPlayers(players);
            game.state.setTotalRounds(totalRounds);
            game.state.setTimeLimitSeconds(timeLimit);
            game.state.setStatus("WAITING");
            game.state.setCurrentRound(0);
            game.state.setCurrentQuestion(null);
            game.state.getPlayerAnswers().clear();
            game.state.getPlayerCorrect().clear();
            game.state.setFirstCorrectPlayer(null);
            game.state.getRoundPoints().clear();
            game.state.setRoundEndTime(0);

            for (String p : players) {
                game.state.getScores().put(p, 0);
            }
        }
        return true;
    }

    public boolean deleteGame(String gameId) {
        TriviaGame game = games.get(gameId);
        if (game == null) return false;
        synchronized (game.lock) {
            cancelTimers(game);
        }
        games.remove(gameId);
        return true;
    }

    // ─── Round Logic ─────────────────────────────────────────────────────────

    private void startRound(TriviaGame game, String gameId) {
        int nextRound = game.state.getCurrentRound() + 1;
        if (nextRound > game.state.getTotalRounds()) {
            finishGame(game, gameId);
            return;
        }

        game.state.setCurrentRound(nextRound);
        game.state.setStatus("PLAYING");
        game.state.getPlayerAnswers().clear();
        game.state.getPlayerCorrect().clear();
        game.state.setFirstCorrectPlayer(null);
        game.state.getRoundPoints().clear();

        TriviaQuestion q = game.questions.get(nextRound - 1);
        game.state.setCurrentQuestion(q.hideAnswer());

        long endTime = System.currentTimeMillis() + (game.state.getTimeLimitSeconds() * 1000L);
        game.state.setRoundEndTime(endTime);

        // Broadcast the start of the round to all clients
        broadcast(gameId, game);

        // Schedule auto-end timer
        game.roundTimer = scheduler.schedule(() -> {
            TriviaGame g = games.get(gameId);
            if (g == null) return;
            synchronized (g.lock) {
                if ("PLAYING".equals(g.state.getStatus())) {
                    endRound(g, gameId);
                }
            }
        }, game.state.getTimeLimitSeconds(), TimeUnit.SECONDS);
    }

    private void endRound(TriviaGame game, String gameId) {
        cancelTimers(game);

        game.state.setStatus("ROUND_END");
        game.state.setRoundEndTime(0);

        TriviaQuestion q = game.questions.get(game.state.getCurrentRound() - 1);

        // Reveal correct answer to clients
        game.state.setCurrentQuestion(q.copy());

        // Calculate points
        for (String player : game.state.getPlayers()) {
            int points = 0;
            Boolean correct = game.state.getPlayerCorrect().get(player);
            if (Boolean.TRUE.equals(correct)) {
                points += 100;
                if (player.equals(game.state.getFirstCorrectPlayer())) {
                    points += 50;
                }
            }
            game.state.getRoundPoints().put(player, points);
            game.state.getScores().merge(player, points, Integer::sum);
        }

        // Broadcast round end with results to all clients
        broadcast(gameId, game);

        // Schedule auto-advance to next round after 5 seconds
        game.advanceTimer = scheduler.schedule(() -> {
            TriviaGame g = games.get(gameId);
            if (g == null) return;
            synchronized (g.lock) {
                if ("ROUND_END".equals(g.state.getStatus())) {
                    startRound(g, gameId);
                }
            }
        }, 5, TimeUnit.SECONDS);
    }

    private void finishGame(TriviaGame game, String gameId) {
        cancelTimers(game);
        game.state.setStatus("FINISHED");
        game.state.setCurrentQuestion(null);
        game.state.setRoundEndTime(0);
        lobbyService.onGameFinished(gameId);

        // Broadcast game finished to all clients
        broadcast(gameId, game);
    }

    private void cancelTimers(TriviaGame game) {
        if (game.roundTimer != null) {
            game.roundTimer.cancel(false);
            game.roundTimer = null;
        }
        if (game.advanceTimer != null) {
            game.advanceTimer.cancel(false);
            game.advanceTimer = null;
        }
    }

    private void broadcast(String gameId, TriviaGame game) {
        if (messagingTemplate != null) {
            messagingTemplate.convertAndSend("/topic/trivia/" + gameId, toClientState(game));
        }
    }

    // ─── Client State Projection ─────────────────────────────────────────────

    private TriviaGameState toClientState(TriviaGame game) {
        TriviaGameState s = game.state;

        TriviaGameState client = new TriviaGameState();
        client.setStatus(s.getStatus());
        client.setPlayers(new ArrayList<>(s.getPlayers()));
        client.setScores(new LinkedHashMap<>(s.getScores()));
        client.setCurrentRound(s.getCurrentRound());
        client.setTotalRounds(s.getTotalRounds());
        client.setPlayerAnswers(new LinkedHashMap<>(s.getPlayerAnswers()));
        client.setPlayerCorrect(new LinkedHashMap<>(s.getPlayerCorrect()));
        client.setFirstCorrectPlayer(s.getFirstCorrectPlayer());
        client.setRoundPoints(new LinkedHashMap<>(s.getRoundPoints()));
        client.setRoundEndTime(s.getRoundEndTime());
        client.setTimeLimitSeconds(s.getTimeLimitSeconds());

        // Hide answer during PLAYING
        if ("PLAYING".equals(s.getStatus()) && s.getCurrentQuestion() != null) {
            client.setCurrentQuestion(s.getCurrentQuestion().hideAnswer());
        } else if (s.getCurrentQuestion() != null) {
            client.setCurrentQuestion(s.getCurrentQuestion().copy());
        }

        return client;
    }
}