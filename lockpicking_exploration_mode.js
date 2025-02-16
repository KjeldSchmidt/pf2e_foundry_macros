class SuccessDegree {
  constructor(name, pin_progress, color) {
    this.name = name;
    this.pin_progress = pin_progress;
    this.color = color;
  }
}

const success_degrees = {
  CritSuccess: new SuccessDegree("Critical Success", 2, 'rgb(0, 128, 0)'),
  Success: new SuccessDegree("Success", 1, 'rgb(0, 0, 255)'),
  Failure: new SuccessDegree("Failure", 0, 'rgb(255, 69, 0)'),
  CritFailure: new SuccessDegree("Critical Failure", -1, 'rgb(255, 0, 0)'),
}



class Lock {
  constructor(required_successes, dc, quality_name) {
    this.required_successes = required_successes;
    this.dc = dc;
    this.quality_name = quality_name;
  }
}

const locks = {
  poor: new Lock(2, 15, "Poor"),
  simple: new Lock(3, 20, "Simple"),
  average: new Lock(4, 25, "Average"),
  good: new Lock(5, 30, "Good"),
  superior: new Lock(6, 40, "Superior"),
};



class PickAttempt {
  constructor(roll, check_value, success_degree) {
    this.roll = roll;
    this.check_value = check_value;
    this.success_degree = success_degree;
  }
}

const is_overall_crit_failure = (pick_attempts) => pick_attempts.map(attempt => attempt.success_degree).includes(success_degrees.CritFailure);
const is_overall_crit_success = (pick_attempts) => pick_attempts.every(attempt => attempt.success_degree === success_degrees.CritSuccess);
const count_set_pins = (pick_attempts) => pick_attempts.map(attempt => Math.max(attempt.success_degree.pin_progress, 0)).reduce((acc, num) => acc + num, 0);

function get_overall_sucess_degree(pick_attempts) {
  if (is_overall_crit_failure(pick_attempts)) { return success_degrees.CritFailure; }
  if (is_overall_crit_success(pick_attempts)) { return success_degrees.CritSuccess; }

  return success_degrees.Success;
}


const number_with_sign = (num) => `${num >= 0 ? "+" : ""}${num}`


async function determine_lockpicking_success(bonuses, dc) {
  const roll = await new Roll('1d20').roll();
  game.dice3d?.showForRoll(roll);
  roll_value = roll._total;
  const check_value = roll_value + bonuses;
  
  let success_indicator = 0;
  if (check_value >= dc + 10) { success_indicator = 2; }
  else if (check_value >= dc) { success_indicator = 1; }
  else if (check_value >= dc - 9) { success_indicator = 0; }
  else if (check_value <= dc - 10) { success_indicator = -1; }

  if (roll_value === 20) { success_indicator = Math.min(2, success_indicator + 1) }
  if (roll_value === 1) { success_indicator = Math.max(-1, success_indicator - 1) }

  const success_degree = Object.values(success_degrees).find(degree => degree.pin_progress === success_indicator);

  return new PickAttempt(roll_value, check_value, success_degree);
}

function get_title_html(pick_attempts, lock) {
  let overall_success = get_overall_sucess_degree(pick_attempts);
  return `
    <span style="font-size: var(--font-size-12);">
      <h4 class="action">
        <strong>Pick a Lock</strong>
        <span class="subtitle">(<span>Thievery Check</span>)</span>
      </h4>
      <div class="target-dc-result">
        <div class="target-dc">
          <span>Target: ${lock.quality_name} Lock</span> <span>(DC ${lock.dc})</span>
        </div>
        <div>Result: <span style="color:${overall_success.color}">${overall_success.name}</span></div>
      </div>
    </span>
  `
}

function get_lockpicking_traits_html() {
  return `
    <div class="tags traits" data-tooltip-class="pf2e">
      <span class="tag" data-slug="manipulate" data-tooltip="PF2E.TraitDescriptionManipulate">Manipulate</span>
    </div>
  `
}

function get_thievery_modifiers_html(ad_hoc_skill_bonus) {
  let = modifiers = actor.skills.thievery.modifiers;
  modifiers = modifiers.filter(item => item.enabled);
  let modifier_tags = modifiers.map((mod) => `<span class="tag tag_transparent" data-slug="${mod.slug}}">${mod.label} ${number_with_sign(mod.modifier)}</span>`);

  if (ad_hoc_skill_bonus !== 0) {
    modifier_tags.push(`<span class="tag tag_transparent"}">Other ${number_with_sign(ad_hoc_skill_bonus)}</span>`);
  }

  const modifier_tag_div = `
    <div class="tags modifiers">
      ${modifier_tags.join("\n")}
    </div>
  `;

  return modifier_tag_div;
}

function get_individual_step_html(pick_attempts, lock) {
  attempt_descriptions = pick_attempts.map(attempt => {
    const diff_to_dc = number_with_sign(attempt.check_value - lock.dc);
    const success_degree = attempt.success_degree;
    return `
      <p>
        <span class="action-glyph">2</span>
        <span style="color:${success_degree.color}">${success_degree.name}</span> by ${diff_to_dc}
      <p/>
    `;
  });

  return `
    <div>
      ${attempt_descriptions.join("\n")}
    </div>
  `;
}

function chat_print_lockpicking_summary(pick_attempts, lock, ad_hoc_skill_bonus) {
  const correctly_set_pins = count_set_pins(pick_attempts);
  const success_summary = `<p>Success after ${pick_attempts.length} rounds.`
  const failure_summary = `<p>After ${pick_attempts.length} rounds and ${correctly_set_pins} out of ${lock.required_successes} set pins, the pick broke.</p>`
  const summary = is_overall_crit_failure(pick_attempts) ? failure_summary : success_summary;
  
  let scratch_summary = "You left behind damage that indicates the lock was picked on close scrutiny.";
  if (is_overall_crit_success(pick_attempts)) { scratch_summary = "No visible damage was left on the lock."; } 
  if (is_overall_crit_failure(pick_attempts)) { scratch_summary = "You leave behind obvious damage."; }


  ChatMessage.create({
    content: `
      ${get_title_html(pick_attempts, lock)}
      ${get_lockpicking_traits_html()}
      <hr />
      ${get_thievery_modifiers_html(ad_hoc_skill_bonus)}
      ${get_individual_step_html(pick_attempts, lock)}
      ${summary}
      <p>${scratch_summary}</p>
    `,
    speaker: ChatMessage.getSpeaker({ actor }),
    user: game.user.id
  });
}



await Dialog.prompt({
  title: 'Lockpick',
  content: `
    <div class="form-group" style="padding: 0.5rem 0;">
      <label for="lockSelect">Lock Quality</label>
      <select name="lockSelect" style="float: right">
        <option value="poor">Poor (2, DC15)</option>
        <option value="simple">Simple (3, DC20)</option>
        <option value="average">Average (4, DC25)</option>
        <option value="good">Good (5, DC30)</option>
        <option value="superior">Superior (6, DC40)</option>
      </select>
      <br />
      <div style="margin: 1rem 0;">
        <label for="bonuses" style="float: left">Other Bonuses</label>
        <input type='number' name='bonuses' value=0 style="width: 60%; float: right" />
      </div>
    </div>
  `,

  callback: async(html) => {
    const lock_name = html.find('[name="lockSelect"]').val();
    const lock = locks[lock_name];
    const other_bonuses = parseInt(html.find('[name="bonuses"]').val());

    let correctly_set_pins = 0;
    const pick_attempts = [];
    const total_bonus = parseInt(actor.skills.thievery.check.mod) + other_bonuses;

    while (correctly_set_pins < lock.required_successes) {
      const new_pick_attempt = await determine_lockpicking_success(total_bonus, lock.dc);
      pick_attempts.push(new_pick_attempt);
      
      if (new_pick_attempt.success_degree === success_degrees.CritFailure) {
        break
      }

      correctly_set_pins += new_pick_attempt.success_degree.pin_progress;
    }

    chat_print_lockpicking_summary(pick_attempts, lock, other_bonuses);
  }
});