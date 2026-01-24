NOTES:
* inputs: 
  * a prompt file path
  * Results from validation tooling and checks for veritication of implementation validity
  * Validation methods used (inlcude validations-suite file paths)
  * work done to account for and fix any previously failed validation attemps,.
* Check the git diff of the currently uncommited work done
* review the work done for any immeidealy noticable issues.
* Be critical of the validation tooling. Was it built to validate actual product efficacy and stability, or was the validation curated to this prompt specifically to make it LOOK like it is working / passing testing? EG mock tests that do not actually test real implementation? 
* If work done to account for any previous validation failures is inclued, take that into account. It doesnt mean an immediate pass, but you should be aware that you could be failing the caller just for the sake fo failing them and being overly strict. Be aware of this. The name of the game is speed to production, but limiting to the best of our ability bad validation methods that are redundant, so that your feedback compounds into the harness preventing missuse of validation and bad implementation styles in the future 
* Outputs:
  * A veridct of pass | fail
  * What it will take for the implementation agent to pass? Issues with impementation that need resolving? Issues with the validation tooling that needs readjustment / more convincing results / less redundancy in testing methods / more testing validation to be convinginc? Give strong implementation examples.