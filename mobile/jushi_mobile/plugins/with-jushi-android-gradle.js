const {
  createRunOncePlugin,
  withGradleProperties,
  withProjectBuildGradle,
  withAppBuildGradle,
} = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-jushi-android-gradle';
const PLUGIN_VERSION = '1.0.0';

function setGradleProperty(modResults, key, value) {
  const stringValue = String(value);
  const existing = modResults.find((item) => item.type === 'property' && item.key === key);
  if (existing) {
    existing.value = stringValue;
    return;
  }
  modResults.push({ type: 'property', key, value: stringValue });
}

function findMatchingBrace(contents, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < contents.length; i += 1) {
    const ch = contents[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function insertRepositoryIntoAllProjects(contents, repoUrl) {
  if (contents.includes(repoUrl)) return contents;

  const allProjectsIndex = contents.indexOf('allprojects');
  if (allProjectsIndex < 0) return contents;

  const repositoriesIndex = contents.indexOf('repositories', allProjectsIndex);
  if (repositoriesIndex < 0) return contents;

  const repoBlockOpen = contents.indexOf('{', repositoriesIndex);
  if (repoBlockOpen < 0) return contents;

  const repoBlockClose = findMatchingBrace(contents, repoBlockOpen);
  if (repoBlockClose < 0) return contents;

  const insertLine = `\n    maven { url '${repoUrl}' }`;
  return `${contents.slice(0, repoBlockClose)}${insertLine}${contents.slice(repoBlockClose)}`;
}

function withJushiAndroidGradle(config, options = {}) {
  const {
    gradleJvmArgs = '-Xmx2048m -XX:MaxMetaspaceSize=512m --add-opens=java.base/java.lang=ALL-UNNAMED',
    gradleParallel = true,
    javaHome,
    extraMavenRepos = ['https://www.jitpack.io'],
    newArchEnabled = true,
    forceJsBundleInDebug = true,
  } = options;

  config = withGradleProperties(config, (configProps) => {
    setGradleProperty(configProps.modResults, 'org.gradle.jvmargs', gradleJvmArgs);
    setGradleProperty(configProps.modResults, 'org.gradle.parallel', gradleParallel);

    if (newArchEnabled !== undefined) {
      setGradleProperty(configProps.modResults, 'newArchEnabled', String(newArchEnabled));
    }

    // Avoid hard-coding machine paths unless explicitly configured.
    if (typeof javaHome === 'string' && javaHome.trim()) {
      setGradleProperty(configProps.modResults, 'org.gradle.java.home', javaHome.trim());
    }

    return configProps;
  });

  config = withProjectBuildGradle(config, (configBuildGradle) => {
    if (configBuildGradle.modResults.language !== 'groovy') {
      return configBuildGradle;
    }

    let next = configBuildGradle.modResults.contents;
    for (const repo of extraMavenRepos) {
      if (typeof repo === 'string' && repo.trim()) {
        next = insertRepositoryIntoAllProjects(next, repo.trim());
      }
    }

    configBuildGradle.modResults.contents = next;
    return configBuildGradle;
  });

  config = withAppBuildGradle(config, (configBuildGradle) => {
    if (configBuildGradle.modResults.language !== 'groovy') {
      return configBuildGradle;
    }

    if (forceJsBundleInDebug) {
      let contents = configBuildGradle.modResults.contents;
      // Replace the commented-out default instruction with our override
      // Pattern matches: // debuggableVariants = ["liteDebug", "prodDebug"]
      if (contents.includes('// debuggableVariants = ["liteDebug", "prodDebug"]')) {
        contents = contents.replace(
          '// debuggableVariants = ["liteDebug", "prodDebug"]',
          'debuggableVariants = []'
        );
      } else if (!contents.includes('debuggableVariants = []')) {
        // Fallback: simple append if exact match failed but we want to be sure
        // However, inserting blindly into react {} block is hard with regex. 
        // The replacement above is the most reliable for a fresh prebuild.
      }
      configBuildGradle.modResults.contents = contents;
    }
    return configBuildGradle;
  });

  return config;
}

module.exports = createRunOncePlugin(withJushiAndroidGradle, PLUGIN_NAME, PLUGIN_VERSION);

