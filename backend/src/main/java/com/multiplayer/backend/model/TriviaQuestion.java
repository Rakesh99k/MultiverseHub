package com.multiplayer.backend.model;

import java.util.List;

public class TriviaQuestion {

    private int id;
    private String question;
    private List<String> options;
    private int correctIndex;  // -1 when hidden from clients during PLAYING
    private String category;

    public TriviaQuestion() {}

    public TriviaQuestion(int id, String question, List<String> options, int correctIndex, String category) {
        this.id = id;
        this.question = question;
        this.options = options;
        this.correctIndex = correctIndex;
        this.category = category;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }

    public int getCorrectIndex() { return correctIndex; }
    public void setCorrectIndex(int correctIndex) { this.correctIndex = correctIndex; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    /** Create a copy with the answer hidden */
    public TriviaQuestion hideAnswer() {
        return new TriviaQuestion(id, question, options, -1, category);
    }

    /** Create a full copy */
    public TriviaQuestion copy() {
        return new TriviaQuestion(id, question, options, correctIndex, category);
    }
}