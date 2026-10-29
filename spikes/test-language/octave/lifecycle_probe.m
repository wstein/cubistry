function lifecycle_probe(proofPath, outputDirectory, repetitions)
% The caller emits READY before loading this file or the existing checker.
  assert(repetitions >= 3 && fix(repetitions) == repetitions);
  assert(exist(outputDirectory, 'dir') == 0);
  mkdir(outputDirectory);
  loadStarted = tic;
  argumentCount = nargin('counter_probe');
  assert(argumentCount == 2);
  phase(struct('event', 'LOAD', 'elapsedMs', toc(loadStarted) * 1000, ...
    'scope', 'Checker parse/load through function metadata lookup; no test body'));
  for iteration = 0:repetitions
    output = fullfile(outputDirectory, sprintf('lifecycle-%d.json', iteration));
    assert(exist(output, 'file') == 0);
    started = tic;
    result = counter_probe(proofPath, output);
    stateHash = hash('sha256', fileread(output));
    elapsed = toc(started) * 1000;
    assert(result.values == 100 && result.inverseWords == 100);
    assert(result.negativeControls == 6);
    phase(struct('event', 'RESULT', 'iteration', iteration, ...
      'elapsedMs', elapsed, 'values', result.values, ...
      'inverseChecks', result.inverseWords, ...
      'negativeControls', result.negativeControls, ...
      'fullStickerFrames', 2400, 'checksum', stateHash));
  end
  phase(struct('event', 'DONE'));
end

function phase(event)
  fprintf('CUBISTRY_PHASE %s\n', jsonencode(event));
  fflush(stdout);
end
