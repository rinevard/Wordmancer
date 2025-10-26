# Wordmancer

Wordmancer is a card battle game where you wield the power of words to cast magic.

## Gameplay

In this game, you play as a magician in a turn-based battle against an enemy. You will draw cards with basic concepts on them. By combining these word cards, you can create unique spells.

To cast a spell, you must describe its effect in your own words. For example, by combining "Fire" and "Sword", you can say "I summon a flaming sword!".

The game uses a Large Language Model (LLM) as the game master. The LLM interprets your spell description and determines its effect in the game, such as summoning a minion, dealing damage to the enemy, or creating a shield for you. The game master will then narrate the outcome of your spell, and the game state will update accordingly.

After your turn, any minions you have on the battlefield will automatically attack the enemy. Then, the enemy will take its turn. You will then draw new word cards and a new turn begins.

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

You need to have Node.js installed on your system. The recommended version is 20.19.0 or higher.

### Installation

1. Clone the repository to your local machine.
2. Open a terminal in the project's root directory.
3. Run the following command to install the necessary dependencies:

```sh
npm install
```

### Environment Variables

This project requires API keys for its AI services to function. You will need to create a .env file in the root directory of the project.

1. Create a file named .env in the project root.
2. Add the following lines to the file, replacing YOUR_API_KEY with your actual keys:

```
VITE_GEMINI_API_KEY=YOUR_API_KEY
VITE_SOPHNET_API_KEY=YOUR_API_KEY
```

The VITE_GEMINI_API_KEY is for the Google Gemini API, which is used for core game logic.
The VITE_SOPHNET_API_KEY is for another service used in the game.

### Running the Development Server

Once you have installed the dependencies and set up your environment variables, you can start the development server.

```sh
npm run dev
```

This will start the application in development mode. You can then open your browser and navigate to the local address provided in the terminal to play the game.

## Available Scripts

- `npm run dev`: Runs the app in development mode.
- `npm run build`: Builds the app for production.
- `npm run preview`: Previews the production build locally.
- `npm run lint`: Lints the project files.
