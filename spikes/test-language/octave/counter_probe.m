function result = counter_probe(path, exportPath)
% Limited independent exact-frame probe; not a full production proof checker.
  data = jsondecode(fileread(path));
  started = tic;
  states = check(data);
  elapsed = toc(started);
  if nargin > 1
    file = fopen(exportPath, 'w');
    need(file >= 0, 'Output file');
    fprintf(file, '%s\n', jsonencode(states));
    fclose(file);
  end
  negative = 0;
  bad = data; bad.printing(1).id = true; reject(bad); negative = negative + 1;
  bad = data; bad.printing(1).n = [0.5, 0.5, 0]; reject(bad); negative = negative + 1;
  bad = data; bad.printing(2).id = bad.printing(1).id; reject(bad); negative = negative + 1;
  bad = data; bad.witnesses(1).word = 'R3'; reject(bad); negative = negative + 1;
  bad = data; bad.printing(1).image = 'corrupt'; reject(bad); negative = negative + 1;
  bad = data; bad.printing(1).up = -bad.printing(1).up; reject(bad); negative = negative + 1;
  % Numeric behavior matters: the cube domain is tiny, but unbounded IDs are not.
  assert(mod(-1, 4) == 3);
  assert(isequal(int8(127) + int8(1), int8(127)));
  assert(jsondecode('9007199254740993') == jsondecode('9007199254740992'));
  result = struct('runtime', version(), 'values', 100, 'inverseWords', 100, ...
    'stickers', 24, 'negativeControls', negative, 'elapsedSeconds', elapsed, ...
    'scope', 'padded canonical witnesses only; not full Python replacement');
  fprintf('%s\n', jsonencode(result));
end

function reject(data)
  rejected = false;
  try
    check(data);
  catch err
    rejected = strcmp(err.identifier, 'cube:invalid');
    if ~rejected, rethrow(err); end
  end
  need(rejected, 'Negative control unexpectedly accepted');
end

function need(ok, message)
  if ~ok, error('cube:invalid', '%s', message); end
end

function ok = integer(value)
  ok = isnumeric(value) && ~islogical(value) && isscalar(value) ...
    && isfinite(value) && fix(value) == value;
end

function ok = axis(value)
  if ~isnumeric(value) || islogical(value), ok = false; return; end
  value = value(:)';
  ok = numel(value) == 3 && all(isfinite(value)) ...
    && all(fix(value) == value) && sum(abs(value)) == 1;
end

function states = check(data)
  need(integer(data.schema) && data.schema == 1, 'Schema');
  need(strcmp(data.puzzle, '2x2x2'), 'Puzzle');
  source = data.printing;
  need(numel(source) == 24, '24 stickers');
  ids = zeros(1, 24); frames = zeros(24, 6);
  for i = 1:24
    s = source(i);
    need(integer(s.id) && integer(s.cubie), 'Integer identities');
    ids(i) = s.id;
    p = s.p(:)'; n = s.n(:)'; up = s.up(:)';
    need(isnumeric(s.p) && ~islogical(s.p) && numel(p) == 3 ...
      && all(abs(p) == 1), 'Position');
    need(axis(n) && axis(up) && dot(n, up) == 0, 'Tangent frame');
    need(dot(p, n) == 1, 'Outward normal');
    frames(i, :) = [p, n];
  end
  need(isequal(sort(ids), 0:23), 'Distinct identities');
  need(size(unique(frames, 'rows'), 1) == 24, 'Distinct facelets');
  need(numel(data.witnesses) == 100, '100 witnesses');
  states = cell(100, 1);
  for value = 0:99
    witness = data.witnesses(value + 1);
    need(integer(witness.value) && witness.value == value, 'Witness value');
    state = apply(source, witness.word);
    states{value + 1} = state;
    show(state, value);
    restored = apply(state, inverse(witness.word));
    need(isequal(restored, source), 'Inverse full-frame restoration');
  end
end

function show(state, value)
  positions = [-1,1,1; 1,1,1; -1,-1,1; 1,-1,1];
  expected = {'title-left', 'title-right', ...
    sprintf('%d', floor(value / 10)), sprintf('%d', mod(value, 10))};
  for cell = 1:4
    found = [];
    for i = 1:24
      if isequal(state(i).p(:)', positions(cell,:)) ...
          && isequal(state(i).n(:)', [0,0,1])
        found(end + 1) = i;
      end
    end
    need(numel(found) == 1, 'Exactly one front sticker');
    s = state(found);
    need(strcmp(s.image, expected{cell}), 'Immutable front image');
    need(isequal(s.up(:)', [0,1,0]), 'Upright printed glyph');
  end
end

function state = apply(state, word)
  moves = strsplit(strtrim(word));
  if isempty(strtrim(word)), return; end
  faces = 'RLUDFB'; axes = [1,1,2,2,3,3];
  layers = [1,-1,1,-1,1,-1]; directions = [-1,1,-1,1,-1,1];
  for t = 1:numel(moves)
    token = moves{t};
    need(~isempty(regexp(token, '^[RLUDFB](2|'')?$', 'once')), 'Legal move');
    f = find(faces == token(1)); amount = 1;
    if numel(token) == 2
      if token(2) == '2', amount = 2; else amount = -1; end
    end
    amount = mod(amount * directions(f), 4);
    for i = 1:24
      if state(i).p(axes(f)) == layers(f)
        % Preserve the decoded JSON vector shape, including exact inverse checks.
        fields = {'p', 'n', 'up'};
        for j = 1:3
          field = fields{j}; original = state(i).(field); vector = original(:)';
          for turn = 1:amount
            x = vector(1); y = vector(2); z = vector(3);
            if axes(f) == 1, vector = [x,-z,y];
            elseif axes(f) == 2, vector = [z,y,-x];
            else vector = [-y,x,z]; end
          end
          state(i).(field) = reshape(vector, size(original));
        end
      end
    end
  end
end

function word = inverse(word)
  if isempty(strtrim(word)), word = ''; return; end
  moves = strsplit(strtrim(word));
  for i = 1:numel(moves)
    token = moves{i};
    if token(end) == '2', moves{i} = token;
    elseif token(end) == '''', moves{i} = token(1:end-1);
    else moves{i} = [token, '''']; end
  end
  word = strjoin(fliplr(moves), ' ');
end
