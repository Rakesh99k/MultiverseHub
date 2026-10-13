package com.multiplayer.backend.model;

import java.util.*;

public class TriviaGameState {

    private String status;           // WAITING, COUNTDOWN, PLAYING, ROUND_END, FINISHED
    private List<String> players;
    private Map<String, Integer> scores;       // playerName → total score
    private int currentRound;
    private int totalRounds;
    private TriviaQuestion currentQuestion;    // null during WAITING/FINISHED
    private Map<String, Integer> playerAnswers; // playerName → selected option index
    private Map<String, Boolean> playerCorrect; // playerName → was their answer correct
    private String firstCorrectPlayer;         // name of first correct answerer (null if none)
    private Map<String, Integer> roundPoints;  // playerName → points earned this round
    private long roundEndTime;                 // epoch millis when round timer expires (0 if not active)
    private int timeLimitSeconds;

    public TriviaGameState() {
        this.players = new ArrayList<>();
        this.scores = new LinkedHashMap<>();
        this.status = "WAITING";
        this.currentRound = 0;
        this.totalRounds = 10;
        this.playerAnswers = new LinkedHashMap<>();
        this.playerCorrect = new LinkedHashMap<>();
        this.roundPoints = new LinkedHashMap<>();
        this.timeLimitSeconds = 15;
    }

    // --- Getters / Setters ---

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getPlayers() { return players; }
    public void setPlayers(List<String> players) { this.players = players; }

    public Map<String, Integer> getScores() { return scores; }
    public void setScores(Map<String, Integer> scores) { this.scores = scores; }

    public int getCurrentRound() { return currentRound; }
    public void setCurrentRound(int currentRound) { this.currentRound = currentRound; }

    public int getTotalRounds() { return totalRounds; }
    public void setTotalRounds(int totalRounds) { this.totalRounds = totalRounds; }

    public TriviaQuestion getCurrentQuestion() { return currentQuestion; }
    public void setCurrentQuestion(TriviaQuestion currentQuestion) { this.currentQuestion = currentQuestion; }

    public Map<String, Integer> getPlayerAnswers() { return playerAnswers; }
    public void setPlayerAnswers(Map<String, Integer> playerAnswers) { this.playerAnswers = playerAnswers; }

    public Map<String, Boolean> getPlayerCorrect() { return playerCorrect; }
    public void setPlayerCorrect(Map<String, Boolean> playerCorrect) { this.playerCorrect = playerCorrect; }

    public String getFirstCorrectPlayer() { return firstCorrectPlayer; }
    public void setFirstCorrectPlayer(String firstCorrectPlayer) { this.firstCorrectPlayer = firstCorrectPlayer; }

    public Map<String, Integer> getRoundPoints() { return roundPoints; }
    public void setRoundPoints(Map<String, Integer> roundPoints) { this.roundPoints = roundPoints; }

    public long getRoundEndTime() { return roundEndTime; }
    public void setRoundEndTime(long roundEndTime) { this.roundEndTime = roundEndTime; }

    public int getTimeLimitSeconds() { return timeLimitSeconds; }
    public void setTimeLimitSeconds(int timeLimitSeconds) { this.timeLimitSeconds = timeLimitSeconds; }
}