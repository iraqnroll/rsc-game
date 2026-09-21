const EXPERIENCE_ARRAY = [0];

let totalExperience = 0;

for (let i = 1; i < 99; i++) {
    const level = i;
    const experience = Math.floor(level + 300 * Math.pow(2, level / 7));
    totalExperience += experience;
    EXPERIENCE_ARRAY[i] = totalExperience & 0xffffffc;
}

function experienceToLevel(experience) {
    let level = 1;

    for (let i = 0; i < EXPERIENCE_ARRAY.length; i += 1) {
        if (EXPERIENCE_ARRAY[i] > experience) {
            return level;
        }

        level = i + 1;
    }

    return level;
}

// Levels aren't saved -- they come back from experience when a player logs
// in. A drained skill restores on its own, but one saved without a current
// level at all never would, so it comes back at its own level.
function loadSkillLevels(skills) {
    for (const skill of Object.values(skills)) {
        skill.base = experienceToLevel(skill.experience);

        if (!Number.isFinite(skill.current)) {
            skill.current = skill.base;
        }
    }

    return skills;
}

function formatSkillName(skill) {
    if (skill === 'woodcutting') {
        return 'Woodcut';
    }

    if (skill === 'defense') {
        return 'Defence';
    }

    return skill.slice(0, 1).toUpperCase() + skill.slice(1, skill.length);
}

module.exports = { experienceToLevel, formatSkillName, loadSkillLevels };
