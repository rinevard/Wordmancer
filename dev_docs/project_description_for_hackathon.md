# Wordmancer: Weave Your Own Magic

## What is Wordmancer?

Wordmancer is an AI-powered card battler where your creativity is your greatest weapon. You combine word cards representing core concepts—like "Time," "Summon," or "Growth"—and then describe the spell you wish to cast in your own words. An AI Game Master interprets your command and brings your magic to life, creating a unique and emergent gameplay experience every single turn.

Whether you command the AI to "Create a mirror image of the enemy, but under my control," or even attempt to "Rewind time to the start of my previous turn," the AI understands these commands and adjudicates the outcome, updating the game state in real-time.

## Technologies We Used

*   **Frontend:** The entire user interface is built with **Vue.js 3** and powered by **Vite**, creating a reactive and performant player experience.
*   **The Game Master (Core LLM):** Wordmancer's brain is powered by advanced Large Language Models. We utilize two powerful backends:
    *   **SophNet API (DeepSeek-V3-Fast model):** This is our primary engine for fast-paced gameplay, providing near-instantaneous responses to player actions, which is crucial for a fluid and engaging experience.
    *   **Google's Gemini 2.5 Pro:** We also leverage Gemini for its powerful reasoning and narrative generation capabilities, showcasing the flexibility of our architecture.
*   **Dynamic Creature Art (Text-to-Image):** When you summon a new minion, we use the **SophNet Text-to-Image API** (running the `qwen-image` model) to generate a unique piece of art for it on the fly. If you summon a "Flaming Sword," you see a flaming sword.
*   **Immersive Narration (Text-to-Speech):** The AI Game Master's narration is brought to life using the browser's native **Web Speech API (`SpeechSynthesis`)**, providing an engaging audio experience without extra dependencies.

## Future Plans

*   **Smarter Art Generation:** We noticed that the AI-generated images for minions can sometimes be repetitive. Our next step is to have the core LLM (the Game Master) dynamically write a more descriptive and creative prompt for the text-to-image model, rather than just using the minion's name and a fixed template. This will create more unique and visually diverse creatures.
*   **Emergent Gameplay Beyond Combat:** During playtesting, we were amazed to find players successfully guiding the AI to create narratives and actions far beyond the scope of simple combat. Players managed to have the AI introduce new enemies after a battle, discover and collect magical artifacts, and trigger small side-quests. This happened organically, without us explicitly programming these features. We see this as a massive validation of the game's potential and plan to build robust systems to support this emergent, open-ended role-playing experience.
