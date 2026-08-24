module_source := invocation_directory()
root := justfile_directory()
module_name := shell('realpath --relative-to="$1" "$2"', root, module_source)

windows_user_dir := `wslpath "$(cmd.exe /C echo %USERPROFILE% | tr -d '\r')"`
foundry_module_base_dir := windows_user_dir + "/AppData/Local/FoundryVTT/Data/modules"
foundry_module_target_dir := foundry_module_base_dir + "/" + module_name



sync:
    echo "{{module_source}}"
    echo "{{foundry_module_target_dir}}"
    rm -rf "{{foundry_module_base_dir}}/{{module_name}}"
    cp -r "{{module_source}}" "{{foundry_module_target_dir}}"
