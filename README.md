# DietYaar 🍽️
### Your Campus Food & Meal-Planning Companion

DietYaar is a student-focused meal-planning and food-discovery web application designed around the everyday challenges of college life. Students often have busy class schedules, limited time between lectures, different dietary preferences, and a fixed food budget. DietYaar brings meal suggestions, weekly planning, campus food discovery, and basic progress tracking into one simple interface.

Instead of giving every student the same generic diet chart, DietYaar uses the information entered in the student's profile—such as their goal, dietary preference, food restrictions, preferred food sources, meal timings, and budget—to filter and rank suitable meal options available in the application's food data.

> **Current implementation:** DietYaar is a React + Vite client-side application. User information is saved in the browser using `localStorage`. The current version does not use Supabase, a cloud database, live menu APIs, or an external AI model.

---

## Contents

- [Project Overview](#project-overview)
- [Why DietYaar?](#why-dietyaar)
- [Key Features](#key-features)
- [Campus Food Locations](#campus-food-locations)
- [How DietYaar Works](#how-dietyaar-works)
- [Recommendation Methodology](#recommendation-methodology)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Application Modules](#application-modules)
- [Data Storage and Privacy](#data-storage-and-privacy)
- [Validation and Responsible Use](#validation-and-responsible-use)
- [Current Limitations](#current-limitations)
- [Future Enhancements](#future-enhancements)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)

---

## Project Overview

| Item | Details |
|---|---|
| Project name | DietYaar |
| Category | Student wellness / meal planning |
| Application type | Frontend web application |
| Frontend | React |
| Build tool | Vite |
| Language | JavaScript (JSX) |
| Styling | CSS and application-level styles |
| Icons | Lucide React |
| Current persistence | Browser `localStorage` |
| Primary users | College students |

### Project Goal

To help students make more organised everyday food decisions by connecting their personal preferences with meal options represented in the application and food locations around their college environment.

## Why DietYaar?

College students may face a combination of practical food-planning problems:

- **Busy schedules:** Classes, practicals, assignments, and travel can make meal timings irregular.
- **Limited choices:** Students usually choose from a small set of mess, canteen, café, hostel, or nearby food options.
- **Different preferences:** Students may follow vegetarian, eggetarian, non-vegetarian, or vegan diets.
- **Budget constraints:** Food decisions often need to fit a student's daily or per-meal budget.
- **Repetitive meals:** Convenient options can become repetitive when students do not have an organised plan.
- **Lack of tracking:** It can be difficult to remember meals already eaten or maintain a consistent routine.

DietYaar aims to make these decisions easier through one student-oriented interface.

## Key Features

### 1. Personalised Onboarding and Profile

Students can create a profile by entering information used by the application to personalise meal suggestions.

Profile information includes:
- Basic details such as age, height, and weight.
- Personal goal and activity-related information.
- Dietary preference: vegetarian, eggetarian, non-vegetarian, or vegan.
- Food likes and dislikes.
- Dietary restrictions and allergy information.
- Preferred food sources and meal timings.
- Meal budget preference.

The profile can be revisited and updated through the Profile section.

### 2. “What Should I Eat Right Now?”

This is DietYaar's central meal-discovery experience.

The Home screen identifies the relevant meal period and presents suitable options from the meal data available in the application. Recommendations can take the following into account:

- The student's selected goal.
- Dietary preference and restrictions.
- Current meal type and time context.
- Preferred food source or location.
- Budget preference, where price information is available.
- Previously completed or recently selected meals, to support variety.

The user can review suggestions and choose an option or ask to see alternatives.

### 3. Daily and Weekly Meal Planning

The Plan section helps students organise meals across the week.

It supports:
- Viewing meal slots for different days.
- Reviewing planned meal options.
- Swapping a planned meal for an alternative.
- Marking meals as completed or missed.
- Recording additional meals.
- Reviewing meal activity and history.

### 4. Food Explorer

Food Explorer brings together food choices associated with the campus locations represented in the application. It helps students browse available food information without moving between separate lists.

### 5. Budget-Aware Suggestions

Students can set a preferred per-meal budget. When a meal has price information in the application's data, budget can contribute to recommendation ranking.

Budget information is used as a planning preference; DietYaar does not process payments or place orders.

### 6. BMI and Progress

The Profile / Progress experience includes:
- BMI calculation based on entered height and weight.
- An informational BMI display.
- Weight check-ins and weight-history information.

BMI is included as a basic informational feature, not as a medical diagnosis.

### 7. Meal History and Variety

Meal activity is retained so students can review their choices. Recent meal history can also contribute to recommendation variety, helping reduce repetitive suggestions.

### 8. Profile Photo and Preferences

The profile experience supports profile-photo handling and editing of saved preferences.

---

## Campus Food Locations

The current application represents the following college food locations:

| Location | Type |
|---|---|
| Anna Canteen | College canteen |
| Brew Beans Café | Campus café |
| Matri Katta | Campus food location |
| Poolside Canteen | College canteen |

**Data note:** Menu items, prices, ingredients, and availability are only as reliable as the data included in the application. The current application is not connected to a live menu or inventory service. Do not interpret a displayed option as confirmation that it is currently available or that a location is open.

---

## How DietYaar Works

At a high level, the application follows this flow:

1. **Onboarding:** The student enters profile information and food preferences.
2. **Profile setup:** The application stores the profile details and selected preferences.
3. **Meal context:** The application identifies the meal period relevant to the current view.
4. **Candidate selection:** The recommendation logic loads meal combinations from the bundled application data.
5. **Filtering:** Options are checked against relevant profile constraints and food-source preferences.
6. **Ranking:** Eligible options are scored using recommendation factors.
7. **Display:** The highest-ranked suitable options are shown to the student.
8. **Meal activity:** The student can select, swap, complete, or mark meals as missed.
9. **Persistence:** Application state is saved in the current browser's local storage.

## Recommendation Methodology

DietYaar currently uses a **rule-based recommendation approach**. It does not send profile information to an external AI model.

The recommendation process can be described in two stages:

### Stage 1 — Eligibility Filtering

Candidate meal combinations are checked against relevant information such as:

- Meal type and meal context.
- Dietary preference and diet-related flags in the meal data.
- Ingredient information available in the application.
- Restrictions and allergy terms represented by the profile and meal data.
- Selected food sources and location preferences.
- Day or plan availability information.

Options that do not meet the relevant checks are filtered out.

### Stage 2 — Ranking Suitable Options

Remaining eligible options are scored using factors represented in the recommendation logic, such as:

- Personal goal.
- Dietary preference.
- Preferred food source.
- Food likes and dislikes.
- Meal timing and context.
- Activity-related profile information.
- Budget, when price information exists.
- Variety and recent meal history.

The application ranks the eligible options and presents the top suggestions.

> **Important:** The recommendation result depends on the completeness and accuracy of the bundled meal data. Unknown ingredients must not be assumed safe for allergies. A recommendation is a planning suggestion, not a medical or nutrition prescription.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| React | Building the component-based user interface |
| JavaScript (JSX) | Application logic and UI structure |
| Vite | Local development server and production build |
| CSS | Layout, styling, responsive presentation, and visual states |
| Lucide React | Icons used in the interface |
| Browser `localStorage` | Saving and restoring application data on the same browser |

### Why React and Vite?

- React supports reusable UI components and state-driven interfaces.
- Vite provides a fast local development server and a production build process.
- JavaScript and JSX allow UI and application logic to be maintained in the same project.
- `localStorage` provides a simple client-side persistence mechanism for the current prototype.

---

## Project Structure

The project uses a Vite + React structure. The main files are:

```text
DietYaar/
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── assets/
│   │   └── ...
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
│
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

Your repository may contain additional assets or configuration files. Keep the existing Vite files required by your setup.

### Important files

- **`src/App.jsx`** — Main DietYaar application, data definitions, profile and meal state, recommendation logic, UI components, and persistence helpers.
- **`src/main.jsx`** — React entry point that mounts the application.
- **`src/index.css`** — Global reset and root-level styling.
- **`src/App.css`** — Vite starter stylesheet; retain or remove its contents only if the current application no longer depends on it.
- **`package.json`** — Project dependencies and npm scripts.
- **`vite.config.js`** — Vite configuration.
- **`.gitignore`** — Excludes dependencies, build output, local environment files, and temporary files from Git.

---

## Getting Started

Follow these instructions to run DietYaar locally.

### Prerequisites

Install the following before starting:

- **Node.js:** Use a current supported LTS release where possible.
- **npm:** Installed with Node.js.
- **Git:** Required to clone the repository.
- **Code editor:** Visual Studio Code is recommended.
- **Browser:** A modern browser such as Chrome, Edge, or Firefox.

Check that Node.js and npm are installed:

```bash
node -v
npm -v
```

### 1. Clone the repository

```bash
git clone https://github.com/Moizskh024/DietYaar.git
```

### 2. Open the project directory

```bash
cd DietYaar
```

### 3. Install dependencies

```bash
npm install
```

### 4. Install Lucide React if it is not already listed as a dependency

The application imports icons from `lucide-react`. If the package is not already installed by `npm install`, run:

```bash
npm install lucide-react
```

### 5. Start the development server

```bash
npm run dev
```

Vite will print a local development URL in the terminal. The default is usually:

```text
http://localhost:5173/
```

Open the displayed URL in your browser.

### 6. Create a production build

```bash
npm run build
```

Vite generates the production-ready files in the `dist/` directory.

### 7. Preview the production build locally

```bash
npm run preview
```

Use the URL printed by Vite to preview the built application.

---

## Available Scripts

The following are standard Vite scripts. Confirm the exact script names in `package.json` if the project configuration has been changed.

| Command | Description |
|---|---|
| `npm run dev` | Starts the local development server |
| `npm run build` | Creates the production build in `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs ESLint, if the script is configured |

---

## Application Modules

| Module | Responsibility |
|---|---|
| Onboarding | Collects initial student information and preferences |
| Profile | Displays and updates profile details, diet, goals, and preferences |
| Home | Shows the current meal context and meal recommendations |
| Recommendation Engine | Filters and ranks eligible meal combinations |
| Plan | Displays daily and weekly meal plans and supports meal updates |
| Meal Tracking | Records completed, missed, and additional meals |
| Food Explorer | Displays food choices associated with campus locations |
| Budget | Stores the student's budget preference for recommendation use |
| Progress | Displays BMI information and weight-history data |
| Meal History | Retains meal activity for review and recommendation variety |
| Persistence | Saves and restores application state in browser storage |

---

## Data Storage and Privacy

The current version uses the browser's **`localStorage`** API.

Application data is saved locally in the browser under the following keys:

| Storage key | Purpose |
|---|---|
| `dietyaar:app-state` | Main application state, including profile and meal-related data |
| `dietyaar:profile-photo` | Profile-photo data |

### What this means

- Data is stored in the browser profile on the device where DietYaar is used.
- Data is not automatically synchronised between devices or browsers.
- Clearing browser site data can remove saved DietYaar information.
- Browser storage has capacity limits; large profile photos may fail to save.
- The current version does not provide server-side authentication or cloud backup.

Do not use the current local-storage prototype to store highly sensitive personal or medical information.

---

## Validation and Responsible Use

- Age, height, and weight fields use validation limits configured in the application.
- Dietary and allergy filtering depends on the ingredient and diet information represented in the bundled data.
- Unknown ingredients must not be treated as safe for a user with an allergy.
- Unconfirmed prices, nutrition values, opening hours, and availability must not be presented as verified facts.
- BMI is informational only and is not a medical diagnosis.
- Meal suggestions are general planning assistance and are not a substitute for advice from a qualified healthcare or nutrition professional.

---

## Current Limitations

- **Local-only persistence:** Data is stored in the current browser and is not shared across devices.
- **No cloud backend:** Supabase or another remote database is not integrated in the current version.
- **No live menus:** Food choices and prices depend on the data bundled with the application.
- **No live availability:** The application does not confirm current stock or opening hours.
- **No food ordering:** Ordering, delivery, and payment processing are not implemented.
- **No external AI service:** Recommendations use application logic and data rather than an external AI API.
- **Data-dependent allergy checks:** Ingredient checks cannot guarantee safety when ingredient information is incomplete.

---

## Future Enhancements

Potential future improvements include:

1. **Supabase integration** for authentication, database storage, and multi-device synchronisation.
2. **Campus menu management** so authorised users can update food items, prices, ingredients, and availability.
3. **Structured allergen information** to improve ingredient transparency.
4. **Verified nutrition information** from reliable data sources.
5. **Meal-plan export** so students can save or share their plans.
6. **Optional reminders** for meal planning and progress check-ins.
7. **Automated testing** for profile validation, recommendation filtering, meal planning, and persistence.
8. **Improved accessibility** including keyboard navigation and assistive-technology support.

---

## Troubleshooting

### `npm` is not recognised

Install Node.js, reopen the terminal, and verify:

```bash
node -v
npm -v
```

### `Module not found: lucide-react`

Install the missing icon package:

```bash
npm install lucide-react
```

### The application does not start

Try reinstalling dependencies:

```bash
npm install
npm run dev
```

If the issue continues, review the first error shown in the terminal and the browser developer console.

### Changes are not appearing

- Save the edited file.
- Check the terminal for build or syntax errors.
- Refresh the browser.
- If necessary, stop and restart the Vite development server.

### Saved information is missing

- Confirm that you are using the same browser and browser profile.
- Check whether browser site data was cleared.
- Avoid using private/incognito browsing for data you expect to retain.
- Remember that localStorage data does not automatically transfer to another device.

---

## Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make and test your changes.
4. Commit your work:

   ```bash
   git add .
   git commit -m "Add: describe your change"
   ```

5. Push your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

6. Open a Pull Request describing the change.

Please avoid committing `.env` files, credentials, private user data, or `node_modules/`.

---

## Acknowledgements

- React — https://react.dev/
- Vite — https://vite.dev/
- Lucide — https://lucide.dev/
- MDN Web Docs — https://developer.mozilla.org/

Third-party packages and assets remain subject to their respective licences. Add any additional data sources, assets, or contributors used in the final project before publication.

---

## Author

**Moiz Shaikh**

GitHub: [@Moizskh024](https://github.com/Moizskh024)

Project repository: [DietYaar](https://github.com/Moizskh024/DietYaar)

---

<p align="center">
  Made with care for students navigating campus life. 💙
</p>
